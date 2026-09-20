// types.ts — the normalized contract every layer shares.
// Provider payloads get mapped INTO these; letters and the dashboard read FROM them.

export type BureauKey = "equifax" | "experian" | "transunion";
export const ALL_BUREAUS: BureauKey[] = ["equifax", "experian", "transunion"];

export type ItemClass = "negative" | "positive" | "neutral";

// Detected, machine-derived reasons an item *may* be disputable. These are
// signals for the UI, not assertions of fact. A user still has to confirm a
// basis before a "factual claim" letter (not_mine, paid_in_full...) is generated.
export type NegativeSignal =
  | "late_payment"
  | "charge_off"
  | "collection"
  | "repossession"
  | "public_record"
  | "high_utilization"
  | "past_reporting_window"; // §605 candidate

// Reason codes the user/agent selects when disputing.
export type DisputeReasonCode =
  | "not_mine"            // factual claim — requires asserted basis
  | "incorrect_balance"  // factual claim — requires asserted basis
  | "paid_in_full"       // factual claim — requires asserted basis
  | "never_late"         // factual claim — requires asserted basis
  | "unauthorized_inquiry" // factual claim — requires asserted basis
  | "duplicate"          // factual claim — requires asserted basis
  | "outdated"           // self-justifying from DOFD (§605)
  | "unverifiable"       // procedural — request verification under §611
  | "incorrect_status";  // factual claim — requires asserted basis

// Per-bureau view of a single tradeline (the same account can report
// differently at each bureau — that mismatch is itself disputable).
export interface BureauPresence {
  bureau: BureauKey;
  reportedBalance?: number;
  highBalance?: number;
  accountStatus?: string;   // "Open", "Closed", "Charge-off", "Collection"...
  paymentStatus?: string;   // "Current", "30 days late", "Collection"...
  dateReported?: string;    // ISO 8601
}

export interface Tradeline {
  id: string;
  creditorName: string;
  accountNumberMasked: string;     // safe to display/print (e.g. "****4471")
  accountNumberEnc?: string;       // full number, field-encrypted, never logged
  accountType: string;             // "Credit Card", "Auto Loan", "Collection"...
  openedDate?: string;
  dateOfFirstDelinquency?: string; // drives the §605 7yr / 10yr clock
  classification: ItemClass;
  signals: NegativeSignal[];
  presence: BureauPresence[];      // which bureaus report it + their values
  possibleDuplicateOf?: string;    // id of another tradeline that looks like the same debt
}

export interface Inquiry {
  id: string;
  subscriberName: string;          // who pulled the credit
  inquiryDate: string;             // ISO 8601
  type: "hard" | "soft";
  bureau: BureauKey;
}

export interface PublicRecord {
  id: string;
  kind: "bankruptcy" | "tax_lien" | "judgment" | "other";
  filedDate?: string;
  status?: string;
  reference?: string;
  bureaus: BureauKey[];
}

export interface PullDiagnostic {
  bureau: BureauKey;
  ok: boolean;
  error?: string;
  attempts: number;
}

export interface CreditProfile {
  consumerId: string;
  pulledAt: string;                // ISO 8601
  bureausRequested: BureauKey[];
  bureausReturned: BureauKey[];
  partial: boolean;                // true if any requested bureau failed
  tradelines: Tradeline[];
  inquiries: Inquiry[];
  publicRecords: PublicRecord[];
  diagnostics: PullDiagnostic[];
}

// What a provider hands back per bureau, before normalization.
export interface RawBureauReport {
  bureau: BureauKey;
  // Provider-specific shape. Kept `unknown` on purpose: the normalizer is the
  // only place that knows how to read a given provider's schema.
  payload: unknown;
}

// Consumer-consent context. A real provider call must be tied to a documented
// permissible purpose and the consumer's authorization token.
export interface PullRequest {
  consumerId: string;
  bureaus: BureauKey[];
  consentToken: string;            // proof the consumer authorized this pull
  permissiblePurpose: string;      // e.g. "consumer-initiated review (1681b(a)(2))"
}
