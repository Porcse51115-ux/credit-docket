// providers/CreditDataProvider.ts — the port.
//
// Everything upstream of normalization depends only on this interface. The
// sandbox, a permissioned aggregator, or a direct bureau B2B2C client are all
// just implementations. This is what keeps the data SOURCE swappable and keeps
// scraping logic from ever leaking into the rest of the system.

import { BureauKey, PullRequest, RawBureauReport } from "../types";

export interface BureauPullOutcome {
  bureau: BureauKey;
  ok: boolean;
  report?: RawBureauReport;
  error?: string;
}

export interface CreditDataProvider {
  readonly name: string;
  /**
   * Pull one bureau. The service layer handles fan-out, retries, and partials,
   * so a provider implementation only needs to do a single authenticated call
   * and return a raw report (or throw / return an error outcome).
   */
  pullBureau(req: PullRequest, bureau: BureauKey): Promise<BureauPullOutcome>;
}
