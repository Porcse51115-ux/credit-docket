// providers/AggregatorProvider.ts — adapter for a permissioned aggregator API.
//
// This is an HTTP client against an OFFICIAL, credentialed API (CRS Credit API,
// Soft Pull Solutions, Equifax CES, etc.). It is intentionally NOT a scraper and
// does NOT accept a consumer's bureau/monitoring-site password. The only thing it
// carries is YOUR API credential plus a per-consumer CONSENT TOKEN your enrollment
// flow obtained — the same model every compliant provider uses.
//
// Fill in baseUrl, auth, the request body, and the response field paths from your
// provider's docs. The shape below matches the common "tri-merge JSON" pattern;
// the normalizer reads `payload` so adjust there if your provider differs.

import { CreditDataProvider, BureauPullOutcome } from "./CreditDataProvider";
import { BureauKey, PullRequest } from "../types";

export interface AggregatorConfig {
  baseUrl: string;                 // e.g. https://api.yourprovider.com/v2
  // OAuth2 client-credentials is typical for B2B credit APIs.
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  // Some providers want a subscriber/member code identifying your credentialed account.
  subscriberCode?: string;
  timeoutMs?: number;
}

export class AggregatorProvider implements CreditDataProvider {
  readonly name = "aggregator";
  private token?: { value: string; expiresAt: number };

  constructor(private cfg: AggregatorConfig) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
    const res = await fetch(this.cfg.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`auth failed: ${res.status}`);
    const j: any = await res.json();
    this.token = { value: j.access_token, expiresAt: Date.now() + (j.expires_in ?? 3000) * 1000 };
    return this.token.value;
  }

  async pullBureau(req: PullRequest, bureau: BureauKey): Promise<BureauPullOutcome> {
    try {
      const token = await this.accessToken();
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 15_000);

      const res = await fetch(`${this.cfg.baseUrl}/credit-report`, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          ...(this.cfg.subscriberCode ? { "x-subscriber-code": this.cfg.subscriberCode } : {}),
        },
        body: JSON.stringify({
          bureau,                                  // request a single bureau
          consumer_id: req.consumerId,
          consent_token: req.consentToken,         // proof of authorization
          permissible_purpose: req.permissiblePurpose,
        }),
      }).finally(() => clearTimeout(t));

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "2");
        return { bureau, ok: false, error: `rate_limited:${retryAfter}` };
      }
      if (!res.ok) return { bureau, ok: false, error: `http_${res.status}` };

      const payload = await res.json();
      return { bureau, ok: true, report: { bureau, payload } };
    } catch (e: any) {
      return { bureau, ok: false, error: e?.name === "AbortError" ? "timeout" : String(e?.message ?? e) };
    }
  }
}
