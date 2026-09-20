// providers/SandboxProvider.ts — runnable fake data for development.
//
// Returns a provider-shaped payload (loosely modeled on a tri-merge JSON) so the
// normalizer, encryption, letter engine, and API can be exercised end to end
// without any bureau access. Includes deliberately messy cases: a balance that
// differs across bureaus, a collection, an old (§605-eligible) charge-off, a
// duplicate, and hard inquiries.

import { CreditDataProvider, BureauPullOutcome } from "./CreditDataProvider";
import { BureauKey, PullRequest } from "../types";

// A single source-of-truth fake report keyed by bureau. Each bureau sees a
// slightly different slice, like the real world.
function fakePayload(bureau: BureauKey) {
  const balanceByBureau: Record<BureauKey, number> = {
    equifax: 842, experian: 842, transunion: 415, // TU disagrees -> disputable mismatch
  };
  return {
    bureau,
    accounts: [
      {
        creditor: "Midland Funding LLC",
        account_number: "517234410098",
        type: "Collection",
        opened: "2021-03-02",
        first_delinquency: "2020-11-15",
        balance: balanceByBureau[bureau],
        high_balance: 842,
        status: "Collection",
        payment_status: "Collection/Chargeoff",
        reported: "2026-05-01",
      },
      {
        creditor: "Capital One",
        account_number: "414720008833",
        type: "Credit Card",
        opened: "2016-07-19",
        first_delinquency: "2017-08-01", // ~8.8 yrs -> §605 candidate
        balance: 0,
        high_balance: 1500,
        status: "Charge-off",
        payment_status: "Charge-off",
        reported: "2025-02-01",
      },
      // Duplicate-looking tradeline (same debt, different furnisher record).
      ...(bureau === "experian"
        ? [{
            creditor: "Midland Credit Management",
            account_number: "517234410098",
            type: "Collection",
            opened: "2021-03-05",
            first_delinquency: "2020-11-15",
            balance: 842,
            high_balance: 842,
            status: "Collection",
            payment_status: "Collection",
            reported: "2026-05-03",
          }]
        : []),
    ],
    inquiries: [
      { subscriber: "CarMax Auto Finance", date: "2026-01-12", kind: "hard" },
      ...(bureau === "transunion"
        ? [{ subscriber: "Unknown Lender LLC", date: "2026-02-20", kind: "hard" }]
        : []),
    ],
    public_records: [],
  };
}

export class SandboxProvider implements CreditDataProvider {
  readonly name = "sandbox";
  // Optional: simulate a flaky bureau to exercise partial-result handling.
  constructor(private failBureaus: BureauKey[] = []) {}

  async pullBureau(_req: PullRequest, bureau: BureauKey): Promise<BureauPullOutcome> {
    await new Promise((r) => setTimeout(r, 40)); // simulate latency
    if (this.failBureaus.includes(bureau)) {
      return { bureau, ok: false, error: "sandbox: simulated bureau timeout" };
    }
    return { bureau, ok: true, report: { bureau, payload: fakePayload(bureau) } };
  }
}
