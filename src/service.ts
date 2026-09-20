// service.ts — orchestration: pull → normalize → encrypt → store.
//
// Owns the resilience policy so providers stay dumb: bounded retries with
// exponential backoff + jitter, Retry-After handling for 429s, and PARTIAL
// success (a profile is still returned if at least one bureau came back).

import { CreditDataProvider } from "./providers/CreditDataProvider";
import { BureauKey, CreditProfile, PullRequest } from "./types";
import { FieldCrypto } from "./crypto";
import { normalize, BureauPullRecord, RawPayload } from "./normalize";
import { ProfileStore } from "./storage";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}
const DEFAULT_RETRY: RetryPolicy = { maxAttempts: 3, baseDelayMs: 300, maxDelayMs: 4000 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class MonitoringService {
  constructor(
    private provider: CreditDataProvider,
    private crypto: FieldCrypto,
    private store: ProfileStore,
    private retry: RetryPolicy = DEFAULT_RETRY
  ) {}

  async pullAndStore(req: PullRequest): Promise<CreditProfile> {
    const results = await Promise.all(
      req.bureaus.map((b) => this.pullOneWithRetry(req, b))
    );

    if (results.every((r) => !r.ok)) {
      throw new Error("all bureau pulls failed: " + results.map((r) => `${r.bureau}=${r.error}`).join(", "));
    }

    const { profile, wrappedDataKey } = await normalize(req.consumerId, results, this.crypto);
    await this.store.put({ profile, wrappedDataKey });
    return profile;
  }

  private async pullOneWithRetry(req: PullRequest, bureau: BureauKey): Promise<BureauPullRecord> {
    let lastErr = "unknown";
    for (let attempt = 1; attempt <= this.retry.maxAttempts; attempt++) {
      const out = await this.provider.pullBureau(req, bureau);
      if (out.ok && out.report) {
        return { ok: true, bureau, payload: out.report.payload as RawPayload, attempts: attempt };
      }
      lastErr = out.error ?? "unknown";

      // Respect explicit rate-limit hints: "rate_limited:<seconds>"
      let delay: number;
      if (lastErr.startsWith("rate_limited:")) {
        delay = Number(lastErr.split(":")[1] || "2") * 1000;
      } else {
        const exp = Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * 2 ** (attempt - 1));
        delay = exp / 2 + Math.random() * (exp / 2); // jitter
      }
      if (attempt < this.retry.maxAttempts) await sleep(delay);
    }
    return { ok: false, bureau, error: lastErr, attempts: this.retry.maxAttempts };
  }
}
