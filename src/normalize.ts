// normalize.ts — raw provider reports → normalized CreditProfile.
//
// Responsibilities:
//  - map each provider account/inquiry into the shared model
//  - merge the SAME account (same furnisher + same number) reported by multiple
//    bureaus into one Tradeline with a `presence[]` entry per bureau, so the
//    dashboard shows one row and cross-bureau mismatches stay visible
//  - flag DIFFERENT furnishers reporting the same account number as a possible
//    duplicate tradeline (a real, disputable inaccuracy)
//  - encrypt full account numbers; expose only a masked form
//  - detect negative signals, including §605 (past reporting window) candidates
//  - assign STABLE, deterministic IDs (hash of stable properties) so the same
//    account across pulls resolves to the same ID — case tracking depends on it
//
// Field paths here match SandboxProvider's payload. If your real provider's JSON
// differs, this file is the ONLY place you change.

import {
  BureauKey, BureauPresence, CreditProfile, Inquiry, NegativeSignal,
  PublicRecord, PullDiagnostic, Tradeline,
} from "./types";
import { FieldCrypto, maskAccount } from "./crypto";
import { createHash } from "crypto";

export interface RawAccount {
  creditor: string; account_number: string; type: string;
  opened?: string; first_delinquency?: string; balance?: number;
  high_balance?: number; status?: string; payment_status?: string; reported?: string;
}
export interface RawInquiry { subscriber: string; date: string; kind: "hard" | "soft"; }
export interface RawPublicRecord {
  kind?: PublicRecord["kind"]; filed?: string; status?: string; reference?: string;
}
export interface RawPayload {
  bureau: BureauKey;
  accounts: RawAccount[];
  inquiries: RawInquiry[];
  public_records: RawPublicRecord[];
}

export interface BureauPullRecord {
  ok: boolean;
  bureau: BureauKey;
  payload?: RawPayload;
  error?: string;
  attempts: number;
}

export interface NormalizeResult {
  profile: CreditProfile;
  wrappedDataKey: string; // per-record data key, wrapped by the master key
}

function yearsBetween(iso?: string): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(+d)) return null;
  return (Date.now() - +d) / (365.25 * 24 * 3600 * 1000);
}

function last4(num: string): string {
  return num.replace(/\D/g, "").slice(-4);
}

// Merge identity for the SAME account across bureaus: full normalized creditor
// name + last 4. Different furnisher names will NOT merge — that's intentional,
// so genuine duplicate tradelines surface instead of being collapsed.
function mergeKey(a: RawAccount): string {
  const creditor = a.creditor.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${creditor}:${last4(a.account_number)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stable IDs
//
// Every ID is a hash of properties that identify the "same thing" across pulls:
//   - Tradeline: normalized creditor + last 4 of account (same as mergeKey)
//   - Inquiry:   normalized subscriber + inquiry date + bureau
//   - Public record: kind + filed date + reference + bureau
//
// Deterministic: pulling the same data next month produces the same IDs, which
// is what lets the case store track "item X, dispute round 2, previous
// outcome Y" across time. Do NOT switch back to randomUUID — see stability
// tests in test/normalize-id-stability.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

export function tradelineId(a: RawAccount): string {
  const creditor = a.creditor.toLowerCase().replace(/[^a-z0-9]/g, "");
  const digits = last4(a.account_number);
  return `tl_${shortHash(`${creditor}:${digits}`)}`;
}

export function inquiryId(q: RawInquiry, bureau: BureauKey): string {
  const sub = q.subscriber.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `iq_${shortHash(`${sub}:${q.date}:${bureau}`)}`;
}

export function publicRecordId(p: RawPublicRecord, bureau: BureauKey): string {
  const kind = p.kind ?? "other";
  const filed = p.filed ?? "";
  const ref = p.reference ?? "";
  return `pr_${shortHash(`${kind}:${filed}:${ref}:${bureau}`)}`;
}

// ─────────────────────────────────────────────────────────────────────────────

function detectSignals(a: RawAccount): NegativeSignal[] {
  const s = new Set<NegativeSignal>();
  const status = `${a.status ?? ""} ${a.payment_status ?? ""}`.toLowerCase();
  if (status.includes("collection")) s.add("collection");
  if (status.includes("charge")) s.add("charge_off");
  if (status.includes("repo")) s.add("repossession");
  if (/\b(30|60|90|120|150|180)\b|late|delinq/.test(status)) s.add("late_payment");

  const limitYears = a.type.toLowerCase().includes("bankrupt") ? 10 : 7;
  const yrs = yearsBetween(a.first_delinquency);
  if (yrs != null && yrs >= limitYears) s.add("past_reporting_window");

  return [...s];
}

function classify(signals: NegativeSignal[]): Tradeline["classification"] {
  return signals.length ? "negative" : "neutral";
}

export async function normalize(
  consumerId: string,
  raws: BureauPullRecord[],
  crypto: FieldCrypto
): Promise<NormalizeResult> {
  const bureausRequested = raws.map((r) => r.bureau);
  const bureausReturned = raws.filter((r) => r.ok).map((r) => r.bureau);
  const diagnostics: PullDiagnostic[] = raws.map((r) => ({
    bureau: r.bureau, ok: r.ok, error: r.error, attempts: r.attempts,
  }));

  // One data key per profile; account numbers encrypted under it.
  const { wrapped, key } = await crypto.newRecordKey();

  const byKey = new Map<string, Tradeline>();
  const inquiries: Inquiry[] = [];
  const publicRecords: PublicRecord[] = [];

  for (const r of raws) {
    if (!r.ok || !r.payload) continue;
    const bureau = r.bureau;

    for (const a of r.payload.accounts) {
      const k = mergeKey(a);
      const signals = detectSignals(a);
      const presence: BureauPresence = {
        bureau,
        reportedBalance: a.balance,
        highBalance: a.high_balance,
        accountStatus: a.status,
        paymentStatus: a.payment_status,
        dateReported: a.reported,
      };

      const existing = byKey.get(k);
      if (existing) {
        existing.presence.push(presence);
        existing.signals = [...new Set([...existing.signals, ...signals])];
      } else {
        byKey.set(k, {
          id: tradelineId(a),
          creditorName: a.creditor,
          accountNumberMasked: maskAccount(a.account_number),
          accountNumberEnc: crypto.encryptField(key, a.account_number),
          accountType: a.type,
          openedDate: a.opened,
          dateOfFirstDelinquency: a.first_delinquency,
          classification: classify(signals),
          signals,
          presence: [presence],
        });
      }
    }

    for (const q of r.payload.inquiries) {
      inquiries.push({
        id: inquiryId(q, bureau),
        subscriberName: q.subscriber,
        inquiryDate: q.date,
        type: q.kind,
        bureau,
      });
    }

    for (const p of r.payload.public_records ?? []) {
      publicRecords.push({
        id: publicRecordId(p, bureau),
        kind: p.kind ?? "other",
        filedDate: p.filed,
        status: p.status,
        reference: p.reference,
        bureaus: [bureau],
      });
    }
  }

  const tradelines = [...byKey.values()];
  flagDuplicates(tradelines);

  const profile: CreditProfile = {
    consumerId,
    pulledAt: new Date().toISOString(),
    bureausRequested,
    bureausReturned,
    partial: bureausReturned.length < bureausRequested.length,
    tradelines,
    inquiries,
    publicRecords,
    diagnostics,
  };

  return { profile, wrappedDataKey: wrapped };
}

// Two distinct tradelines (different furnishers) sharing the same last-4 are a
// likely duplicate of one debt — cross-link them so the UI can offer a
// duplicate dispute.
function flagDuplicates(tradelines: Tradeline[]): void {
  const byLast4 = new Map<string, Tradeline>();
  for (const t of tradelines) {
    const key = t.accountNumberMasked.slice(-4);
    const prev = byLast4.get(key);
    if (prev && prev.creditorName !== t.creditorName) {
      prev.possibleDuplicateOf = t.id;
      t.possibleDuplicateOf = prev.id;
    }
    byLast4.set(key, t);
  }
}
