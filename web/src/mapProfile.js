// mapProfile.js — turn the API's normalized CreditProfile into Credit Docket's
// dashboard item shape, so pulled bureau data drops straight into the UI.

const SIGNAL_TO_TYPE = {
  collection: "Collection",
  charge_off: "Charge-off",
  repossession: "Repossession",
  late_payment: "Late payment",
  public_record: "Bankruptcy",
};

function typeForTradeline(t) {
  for (const s of t.signals || []) {
    if (SIGNAL_TO_TYPE[s]) return SIGNAL_TO_TYPE[s];
  }
  return t.accountType || "Other";
}

function bureausFromPresence(presence = []) {
  const b = { equifax: false, experian: false, transunion: false };
  for (const p of presence) if (p.bureau in b) b[p.bureau] = true;
  return b;
}

function firstDefined(presence = [], key) {
  for (const p of presence) if (p[key] != null) return p[key];
  return "";
}

/** A short, honest note when the data itself suggests a basis (never fabricated). */
function suggestedBasis(t) {
  const notes = [];
  if (t.possibleDuplicateOf) notes.push("Possible duplicate of another tradeline reporting the same account number.");
  const balances = (t.presence || []).map((p) => p.reportedBalance).filter((v) => v != null);
  if (new Set(balances).size > 1) notes.push(`Balance differs across bureaus (${[...new Set(balances)].join(", ")}).`);
  if ((t.signals || []).includes("past_reporting_window")) notes.push("Appears past the §605 reporting window.");
  return notes.join(" ");
}

export function mapProfileToItems(profile) {
  const tradelines = (profile.tradelines || []).map((t) => ({
    id: t.id,
    source: "bureau",
    creditor: t.creditorName,
    accountNumber: t.accountNumberMasked,
    type: typeForTradeline(t),
    bureaus: bureausFromPresence(t.presence),
    dateReported: firstDefined(t.presence, "dateReported"),
    dofd: t.dateOfFirstDelinquency || "",
    balance: firstDefined(t.presence, "reportedBalance"),
    basis: "",
    suggestedBasis: suggestedBasis(t),
    signals: t.signals || [],
    possibleDuplicateOf: t.possibleDuplicateOf || null,
    status: "Not started",
    round: 1,
  }));

  const inquiries = (profile.inquiries || [])
    .filter((q) => q.type === "hard")
    .map((q) => ({
      id: q.id,
      source: "bureau",
      creditor: q.subscriberName,
      accountNumber: "",
      type: "Hard inquiry",
      bureaus: { equifax: q.bureau === "equifax", experian: q.bureau === "experian", transunion: q.bureau === "transunion" },
      dateReported: q.inquiryDate,
      dofd: "",
      balance: "",
      basis: "",
      suggestedBasis: "",
      signals: [],
      status: "Not started",
      round: 1,
    }));

  return [...tradelines, ...inquiries];
}
