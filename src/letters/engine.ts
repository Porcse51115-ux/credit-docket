// letters/engine.ts — render templates with bureau routing and a basis guard.
//
// Given a profile item + a chosen reason + (optional) asserted basis, produce one
// letter per bureau that actually reports the item. The guard enforces the same
// rule as the front end: a factual-claim reason without an asserted basis is a
// frivolous risk (§611(a)(3)) and is NOT rendered.

import {
  BureauKey, CreditProfile, DisputeReasonCode, Inquiry, Tradeline,
} from "../types";
import { TEMPLATES } from "./templates";
import { citeReasonEscalation } from "../shared/law";

const BUREAUS: Record<BureauKey, { name: string; addr: [string, string] }> = {
  equifax: { name: "Equifax Information Services LLC", addr: ["P.O. Box 740256", "Atlanta, GA 30374"] },
  experian: { name: "Experian", addr: ["P.O. Box 4500", "Allen, TX 75013"] },
  transunion: { name: "TransUnion LLC", addr: ["P.O. Box 2000", "Chester, PA 19016"] },
};

export interface Sender {
  name: string; address: string; cityStateZip: string;
  ssnLast4?: string; dob?: string;
}

export interface LetterRequest {
  itemId: string;                 // tradeline id or inquiry id
  reason: DisputeReasonCode;
  assertion?: string;             // the consumer's factual basis, in their words
  bureaus?: BureauKey[];          // override; defaults to bureaus reporting the item
  round?: number;                 // 1 = initial; 3+ adds the escalation paragraph
}

export interface GeneratedLetter {
  itemId: string;
  recipient: string;              // "equifax" | furnisher/collector name
  bureau?: BureauKey;             // set only for bureau-addressed letters
  reason: DisputeReasonCode;
  subject: string;
  text: string;
}

// Reasons whose letter is addressed to the furnisher/collector, not a bureau.
const FURNISHER_ADDRESSED = new Set<DisputeReasonCode>(["furnisher_direct", "debt_validation"]);

// Round 3+ escalation paragraph, citing the reason's escalation statutes. Returns
// "" (nothing appended) for round < 3 or reasons with no escalation plan.
function escalationBlock(reason: DisputeReasonCode, round?: number): string {
  if (!round || round < 3) return "";
  const esc = citeReasonEscalation(reason);
  if (!esc) return "";
  return (
    `This is my formal notice. I have disputed this item previously and the matter remains ` +
    `unresolved. If it is not corrected or deleted, I intend to file complaints with the ` +
    `Consumer Financial Protection Bureau and the Federal Trade Commission, notify my state ` +
    `Attorney General, and have my correspondence reviewed for potential claims, which allow ` +
    `recovery of damages, costs, and attorney's fees under ${esc}.\n\n`
  );
}

export interface LetterResult {
  letters: GeneratedLetter[];
  skipped: { itemId: string; reason: string }[]; // frivolous-risk or routing misses
}

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
function money(n?: number): string {
  return n == null ? "the reported amount" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function idLine(s: Sender): string {
  const bits: string[] = [];
  if (s.ssnLast4) bits.push(`SSN (last 4): ${s.ssnLast4}`);
  if (s.dob) bits.push(`DOB: ${s.dob}`);
  return bits.join("   |   ");
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

function tradelineBureaus(t: Tradeline): BureauKey[] {
  return [...new Set(t.presence.map((p) => p.bureau))];
}

export function generateLetters(
  profile: CreditProfile,
  sender: Sender,
  reqs: LetterRequest[]
): LetterResult {
  const letters: GeneratedLetter[] = [];
  const skipped: LetterResult["skipped"] = [];

  for (const req of reqs) {
    const tmpl = TEMPLATES[req.reason];
    if (!tmpl) { skipped.push({ itemId: req.itemId, reason: `unknown reason ${req.reason}` }); continue; }

    // Basis guard: factual claims require an assertion.
    if (tmpl.requiresAssertion && !(req.assertion && req.assertion.trim())) {
      skipped.push({
        itemId: req.itemId,
        reason: `"${tmpl.label}" is a factual claim — add a basis before disputing (frivolous risk under §611(a)(3)).`,
      });
      continue;
    }

    const tl = profile.tradelines.find((t) => t.id === req.itemId);
    const inq = profile.inquiries.find((q) => q.id === req.itemId);

    if (req.reason === "unauthorized_inquiry") {
      if (!inq) { skipped.push({ itemId: req.itemId, reason: "inquiry not found" }); continue; }
      letters.push(renderInquiry(sender, inq, req));
      continue;
    }

    if (!tl) { skipped.push({ itemId: req.itemId, reason: "tradeline not found" }); continue; }

    // Furnisher/collector-addressed letters (one letter, not per bureau).
    if (FURNISHER_ADDRESSED.has(req.reason)) {
      letters.push(renderFurnisher(sender, tl, req, tmpl.subject, tmpl.body));
      continue;
    }

    // §605 needs a date; refuse if we can't justify it.
    if (req.reason === "outdated" && !tl.dateOfFirstDelinquency) {
      skipped.push({ itemId: req.itemId, reason: "no first-delinquency date to support a §605 obsolescence claim" });
      continue;
    }

    const targets = req.bureaus?.length ? req.bureaus : tradelineBureaus(tl);
    for (const bureau of targets) {
      const presence = tl.presence.find((p) => p.bureau === bureau);
      if (!presence) { skipped.push({ itemId: req.itemId, reason: `not reported by ${bureau}` }); continue; }
      letters.push(renderTradeline(sender, tl, presence.reportedBalance, presence.accountStatus, bureau, req, tmpl.subject, tmpl.body));
    }
  }

  return { letters, skipped };
}

function baseVars(sender: Sender, bureau: BureauKey) {
  const b = BUREAUS[bureau];
  return {
    senderName: sender.name || "[Your name]",
    senderAddress: sender.address || "[Street]",
    senderCityStateZip: sender.cityStateZip || "[City, State ZIP]",
    idLine: idLine(sender),
    date: fmtDate(),
    bureauName: b.name,
    bureauAddrLine1: b.addr[0],
    bureauAddrLine2: b.addr[1],
  };
}

function renderTradeline(
  sender: Sender, tl: Tradeline, balance: number | undefined, status: string | undefined,
  bureau: BureauKey, req: LetterRequest, subjectTmpl: string, bodyTmpl: string
): GeneratedLetter {
  const vars = {
    ...baseVars(sender, bureau),
    creditor: tl.creditorName,
    accountType: tl.accountType,
    acctMasked: tl.accountNumberMasked.slice(-4),
    reportedBalance: money(balance),
    accountStatus: status ?? "[status]",
    dofd: tl.dateOfFirstDelinquency ?? "[date of first delinquency]",
    assertion: req.assertion?.trim() ?? "",
    escalation: escalationBlock(req.reason, req.round),
  };
  const subject = fill(subjectTmpl, vars);
  return {
    itemId: tl.id, recipient: bureau, bureau, reason: req.reason, subject,
    text: fill(bodyTmpl, { ...vars, subject }),
  };
}

function renderInquiry(sender: Sender, inq: Inquiry, req: LetterRequest): GeneratedLetter {
  const tmpl = TEMPLATES.unauthorized_inquiry;
  const vars = {
    ...baseVars(sender, inq.bureau),
    subscriber: inq.subscriberName,
    inquiryDate: inq.inquiryDate,
    acctMasked: "",
    assertion: req.assertion?.trim() ?? "",
    escalation: escalationBlock(req.reason, req.round),
  };
  const subject = fill(tmpl.subject, vars);
  return {
    itemId: inq.id, recipient: inq.bureau, bureau: inq.bureau, reason: req.reason, subject,
    text: fill(tmpl.body, { ...vars, subject }),
  };
}

// A letter addressed to the furnisher/collector rather than a bureau. The
// account address is a placeholder the sender fills in.
function renderFurnisher(
  sender: Sender, tl: Tradeline, req: LetterRequest, subjectTmpl: string, bodyTmpl: string
): GeneratedLetter {
  const p0 = tl.presence[0];
  const vars = {
    senderName: sender.name || "[Your name]",
    senderAddress: sender.address || "[Street]",
    senderCityStateZip: sender.cityStateZip || "[City, State ZIP]",
    idLine: idLine(sender),
    date: fmtDate(),
    bureauName: tl.creditorName,
    bureauAddrLine1: "[Furnisher / collector mailing address]",
    bureauAddrLine2: "",
    creditor: tl.creditorName,
    accountType: tl.accountType,
    acctMasked: tl.accountNumberMasked.slice(-4),
    reportedBalance: money(p0?.reportedBalance),
    accountStatus: p0?.accountStatus ?? "[status]",
    dofd: tl.dateOfFirstDelinquency ?? "[date of first delinquency]",
    assertion: req.assertion?.trim() ?? "",
    escalation: escalationBlock(req.reason, req.round),
  };
  const subject = fill(subjectTmpl, vars);
  return {
    itemId: tl.id, recipient: tl.creditorName, reason: req.reason, subject,
    text: fill(bodyTmpl, { ...vars, subject }),
  };
}
