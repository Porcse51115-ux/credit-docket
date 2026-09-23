import React, { useState, useEffect, useRef } from "react";
import {
  FileText, User, ListChecks, Send, Handshake, Gauge, LayoutDashboard,
  Plus, Trash2, Copy, Download, Check, AlertTriangle, Scale, Clock,
  ShieldCheck, Info, ChevronRight, Building2, X, Activity
} from "lucide-react";
import MonitoringPanel from "./MonitoringPanel.jsx";
import ReportUpload from "./ReportUpload.jsx";

/* ---------------------------------------------------------------------------
   CreditDocket — a grounded, FCRA-based dispute workbench.
   Design language: a legal case file. Ink + warm document paper + one verdigris
   accent. Letters render on a "sheet" with a certified-mail header.
   Custom colors are inline (artifact Tailwind has no arbitrary values).
--------------------------------------------------------------------------- */

const C = {
  ink: "#16191F",
  ink2: "#3A4049",
  paper: "#FBF8F1",
  sheet: "#FFFEFB",
  surface: "#F4F1E9",
  line: "#E2DCCE",
  accent: "#0F6E5C",
  accentSoft: "#E4F0EB",
  clay: "#A8392E",
  claySoft: "#F4E2DE",
  amber: "#9A6B12",
  amberSoft: "#F3E9D2",
  mute: "#7B7363",
};
const display = "'Fraunces', Georgia, serif";
const body = "'Inter', system-ui, sans-serif";
const mono = "'IBM Plex Mono', ui-monospace, monospace";

const BUREAUS = {
  equifax: { name: "Equifax Information Services LLC", addr: ["P.O. Box 740256", "Atlanta, GA 30374"] },
  experian: { name: "Experian", addr: ["P.O. Box 4500", "Allen, TX 75013"] },
  transunion: { name: "TransUnion LLC", addr: ["P.O. Box 2000", "Chester, PA 19016"] },
};

const ITEM_TYPES = [
  "Late payment", "Collection", "Charge-off", "Repossession",
  "Bankruptcy", "Hard inquiry", "Foreclosure", "Tax lien", "Other",
];

const STATUSES = ["Not started", "Disputed", "Deleted", "Updated", "Verified", "Escalated"];
const STATUS_COLOR = {
  "Not started": C.mute, Disputed: C.accent, Deleted: C.accent,
  Updated: C.amber, Verified: C.clay, Escalated: C.clay,
};

const STRATEGIES = [
  { key: "inaccuracy", label: "Factual inaccuracy", target: "bureau",
    blurb: "A specific detail (balance, dates, status) is wrong. Strongest when you can name what's incorrect." },
  { key: "reinvestigation", label: "Verify accuracy & completeness", target: "bureau",
    blurb: "Demand a reasonable reinvestigation. If it can't be verified, it must be deleted." },
  { key: "obsolescence", label: "Obsolete item (§605)", target: "bureau",
    blurb: "Past the 7-year window (10 for bankruptcy). Auto-flagged below when a first-delinquency date is set." },
  { key: "procedural", label: "30-day failure (§611(a)(1))", target: "bureau",
    blurb: "Bureau missed the reinvestigation deadline. Unverified items must come off." },
  { key: "mov", label: "Method of verification (§611(a)(7))", target: "bureau",
    blurb: "After a 'verified' result, demand the description of how it was verified and who was contacted." },
  { key: "furnisher", label: "Direct dispute to furnisher (§623)", target: "furnisher",
    blurb: "Dispute straight to the creditor/collector that reports the data." },
];

/* ----------------------------- helpers ---------------------------------- */
const today = () => new Date();
const fmtDate = (d) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const parseDate = (s) => { const d = new Date(s); return isNaN(d) ? null : d; };
const yearsSince = (s) => { const d = parseDate(s); if (!d) return null; return (today() - d) / (365.25 * 24 * 3600 * 1000); };
const money = (n) => (n || n === 0) ? `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
const uid = () => Math.random().toString(36).slice(2, 9);

function obsoleteEligible(item) {
  const limit = item.type === "Bankruptcy" ? 10 : 7;
  const y = yearsSince(item.dofd);
  return y != null && y >= limit;
}

/* ----------------------------- letter engine ---------------------------- */
function senderBlock(p) {
  return [p.name, p.address, [p.cityStateZip].filter(Boolean).join(""), p.phone]
    .filter(Boolean);
}

function recipientBlock(bureauKey) {
  const b = BUREAUS[bureauKey];
  return [b.name, ...b.addr];
}

function idLine(p) {
  const bits = [];
  if (p.ssnLast4) bits.push(`SSN (last 4): ${p.ssnLast4}`);
  if (p.dob) bits.push(`DOB: ${p.dob}`);
  return bits.join("   |   ");
}

function strategyBody(strategy, item, round) {
  const acct = item.accountNumber ? ` (account no. ${item.accountNumber})` : "";
  const who = item.creditor || "the furnisher";
  const basis = (item.basis || "").trim();
  const basisLine = basis
    ? `Specifically, the following is inaccurate, incomplete, or cannot be substantiated: ${basis}`
    : `I have reviewed this entry and believe it is inaccurate, incomplete, or cannot be substantiated.`;

  switch (strategy) {
    case "inaccuracy":
      return [
        `I am disputing the ${item.type.toLowerCase()} reported by ${who}${acct}.`,
        basisLine,
        `Under the Fair Credit Reporting Act, 15 U.S.C. \u00a71681i (FCRA \u00a7611), you must conduct a reasonable reinvestigation of disputed information. If the furnisher cannot verify that this entry is both accurate and complete, you are required to delete it under \u00a7611(a)(5)(A)(i). Reporting information you cannot verify is not permitted.`,
      ];
    case "reinvestigation":
      return [
        `I am requesting a reinvestigation of the ${item.type.toLowerCase()} reported by ${who}${acct}. I do not believe it is being reported accurately and completely, and I am asking you to verify it.`,
        basis ? `My concern: ${basis}` : "",
        `Under FCRA \u00a7611 (15 U.S.C. \u00a71681i), please confirm the accuracy and completeness of every data field for this account \u2014 balance, payment history, status, and dates. If any field cannot be verified by the furnisher, that field, and where appropriate the entire tradeline, must be corrected or deleted.`,
      ].filter(Boolean);
    case "obsolescence": {
      const limit = item.type === "Bankruptcy" ? "ten (10)" : "seven (7)";
      return [
        `The ${item.type.toLowerCase()} reported by ${who}${acct} is obsolete and must be removed.`,
        `Under FCRA \u00a7605 (15 U.S.C. \u00a71681c), most adverse items may not be reported after ${limit} years${item.type === "Bankruptcy" ? " from the date of filing" : " from the date of first delinquency that led to the action"}.${item.dofd ? ` The controlling date for this account is ${item.dofd}, which exceeds that period.` : ""}`,
        `Please delete this entry as it is past the statutory reporting period.`,
      ];
    }
    case "procedural":
      return [
        `On or about ${item.lastDisputeDate || "[date of prior dispute]"} I disputed the ${item.type.toLowerCase()} reported by ${who}${acct}.`,
        `FCRA \u00a7611(a)(1)(A) (15 U.S.C. \u00a71681i) requires a reinvestigation to be completed within 30 days (45 in limited circumstances). That period has elapsed without a completed reinvestigation or a documented basis for the entry.`,
        `Because the item has not been verified within the time the statute allows, I am requesting its prompt deletion and an updated copy of my file.`,
      ];
    case "mov":
      return [
        `Your agency returned the ${item.type.toLowerCase()} reported by ${who}${acct} as "verified." I am exercising my right to learn how that conclusion was reached.`,
        `Under FCRA \u00a7611(a)(6)(B)(iii) and \u00a7611(a)(7) (15 U.S.C. \u00a71681i), please provide a description of the reinvestigation procedure, including the business name, address, and telephone number of the furnisher you contacted, and the nature of the records relied upon. Please respond within 15 days.`,
        `If the verification consisted only of matching data already on file (e-OSCAR) without confirming the underlying records, it does not satisfy the "reasonable reinvestigation" standard, and the item should be deleted.`,
      ];
    case "furnisher":
      return [
        `I am submitting a direct dispute regarding the ${item.type.toLowerCase()} you report on my file${acct}.`,
        basisLine,
        `As the furnisher, you have duties under FCRA \u00a7623 (15 U.S.C. \u00a71681s-2), including the duty to investigate a direct dispute and to refrain from reporting information you know or have reasonable cause to believe is inaccurate. Please investigate, correct or delete as appropriate, and notify each consumer reporting agency to which you have reported this account.`,
      ];
    default:
      return [basisLine];
  }
}

function roundEscalation(round) {
  if (round <= 1) return [];
  if (round === 2) return [
    `This is a follow-up to my earlier correspondence on this matter. I am keeping a dated record of each dispute and each response. Please treat this as a continuation, not a duplicate, and complete a reasonable reinvestigation rather than dismissing it.`,
  ];
  return [
    `This is my formal notice. I have disputed this item previously and the matter remains unresolved. If it is not corrected or deleted, I intend to file complaints with the Consumer Financial Protection Bureau and the Federal Trade Commission, notify my state Attorney General, and have my correspondence reviewed for potential FCRA claims, which allow recovery of damages, costs, and attorney's fees under 15 U.S.C. \u00a71681n\u20131681o.`,
  ];
}

function buildDisputeLetter({ p, item, bureauKey, round, strategy }) {
  const isFurnisher = strategy === "furnisher";
  const to = isFurnisher
    ? [item.creditor || "[Creditor / Furnisher]", "[Furnisher mailing address]"]
    : recipientBlock(bureauKey);

  const lines = [];
  lines.push(...senderBlock(p));
  const idl = idLine(p);
  if (idl) lines.push(idl);
  lines.push("");
  lines.push(fmtDate(today()));
  lines.push("");
  lines.push("Sent via Certified Mail, Return Receipt Requested");
  lines.push("Tracking No.: ____________________________");
  lines.push("");
  lines.push(...to);
  lines.push("");
  lines.push(`Re: Dispute of inaccurate information \u2014 Round ${round}${item.accountNumber ? ` \u2014 acct ${item.accountNumber}` : ""}`);
  lines.push("");
  lines.push("To Whom It May Concern:");
  lines.push("");
  strategyBody(strategy, item, round).forEach((para) => { lines.push(para); lines.push(""); });
  roundEscalation(round).forEach((para) => { lines.push(para); lines.push(""); });
  lines.push(
    isFurnisher
      ? `Please send written confirmation of the results of your investigation to the address above.`
      : `Please complete your reinvestigation within the time FCRA \u00a7611 allows and send me a corrected copy of my credit file along with written results.`
  );
  lines.push("");
  lines.push("Thank you for your attention to this matter.");
  lines.push("");
  lines.push("Sincerely,");
  lines.push("");
  lines.push("");
  lines.push(p.name || "[Your name]");
  lines.push("");
  lines.push("Enclosures: copy of government-issued photo ID; proof of current address.");
  return lines.join("\n");
}

function buildGoodwillLetter({ p, item }) {
  const acct = item.accountNumber ? ` (account no. ${item.accountNumber})` : "";
  const lines = [];
  lines.push(...senderBlock(p));
  lines.push("");
  lines.push(fmtDate(today()));
  lines.push("");
  lines.push(item.creditor || "[Creditor name]");
  lines.push("[Creditor mailing address]");
  lines.push("");
  lines.push(`Re: Goodwill request${acct}`);
  lines.push("");
  lines.push("Dear Sir or Madam,");
  lines.push("");
  lines.push(
    `I have been a customer in good standing and value our relationship. I am writing about an isolated ${item.type.toLowerCase()} reported on this account${acct}.`
  );
  lines.push("");
  lines.push(
    item.basis
      ? `Some context on what happened: ${item.basis}`
      : `The late payment was a one-time lapse that does not reflect my overall history with the account, which has otherwise been paid as agreed.`
  );
  lines.push("");
  lines.push(
    `I am not disputing the accuracy of the entry. I am respectfully asking, as a goodwill gesture, whether you would be willing to remove this mark from my credit reports with Equifax, Experian, and TransUnion. I understand this is entirely at your discretion, and I would be grateful for your consideration.`
  );
  lines.push("");
  lines.push("Thank you for your time.");
  lines.push("");
  lines.push("Warm regards,");
  lines.push("");
  lines.push("");
  lines.push(p.name || "[Your name]");
  return lines.join("\n");
}

function buildPayForDeleteLetter({ p, item, offer }) {
  const acct = item.accountNumber ? ` (account no. ${item.accountNumber})` : "";
  const lines = [];
  lines.push(...senderBlock(p));
  lines.push("");
  lines.push(fmtDate(today()));
  lines.push("");
  lines.push("Sent via Certified Mail, Return Receipt Requested");
  lines.push("");
  lines.push(item.creditor || "[Collector / Creditor name]");
  lines.push("[Mailing address]");
  lines.push("");
  lines.push(`Re: Settlement offer${acct}`);
  lines.push("");
  lines.push("To Whom It May Concern:");
  lines.push("");
  lines.push(
    `This letter concerns the account referenced above${item.balance ? `, with a reported balance of ${money(item.balance)}` : ""}. This is not an acknowledgment that the debt is valid or that the amount is owed.`
  );
  lines.push("");
  lines.push(
    `I am offering ${offer ? money(offer) : "$______"} as full and final settlement, on the condition that you agree, in writing and before any payment is made, to request deletion of this tradeline from Equifax, Experian, and TransUnion (not merely an update to "paid").`
  );
  lines.push("");
  lines.push(
    `If this is acceptable, please countersign and return this letter or send your own written agreement on company letterhead. I will remit payment within 10 business days of receiving your signed agreement. Without a written agreement, no payment will be sent.`
  );
  lines.push("");
  lines.push("Sincerely,");
  lines.push("");
  lines.push("");
  lines.push(p.name || "[Your name]");
  lines.push("");
  lines.push("Agreed and accepted:");
  lines.push("");
  lines.push("_______________________________   Date: ____________");
  lines.push("(Authorized representative)");
  return lines.join("\n");
}

/* ----------------------------- persistence ------------------------------ */
const KEY = "creditdocket:v1";
function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/* ------------------------------- UI bits -------------------------------- */
function Pill({ children, color, soft }) {
  return (
    <span className="inline-flex items-center rounded-full"
      style={{ background: soft, color, fontFamily: mono, fontSize: 11, padding: "3px 9px", letterSpacing: ".02em" }}>
      {children}
    </span>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span style={{ fontFamily: mono, fontSize: 11, color: C.mute, letterSpacing: ".06em", textTransform: "uppercase" }}>{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span style={{ fontSize: 12, color: C.mute }}>{hint}</span>}
    </label>
  );
}

const inputStyle = {
  width: "100%", background: C.sheet, border: `1px solid ${C.line}`,
  borderRadius: 8, padding: "9px 11px", fontFamily: body, fontSize: 14, color: C.ink, outline: "none",
};

/* ------------------------------- app ------------------------------------ */
export default function CreditDocket() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [showGuide, setShowGuide] = useState(false);
  const [profile, setProfile] = useState({
    name: "", address: "", cityStateZip: "", phone: "", ssnLast4: "", dob: "",
  });
  const [items, setItems] = useState([]);
  const firstLoad = useRef(true);

  useEffect(() => {
    const s = loadState();
    if (s) { setProfile(s.profile || profile); setItems(s.items || []); }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (firstLoad.current) { firstLoad.current = false; return; }
    saveState({ profile, items });
  }, [profile, items, loaded]);

  // Bridge: pull bureau items (from the Monitoring tab) into the main workspace
  // so they appear in Items, Tracking, and the Dashboard. Dedup by id.
  const importBureauItems = (mapped) => {
    setItems((xs) => {
      const have = new Set(xs.map((i) => i.id));
      const additions = mapped
        .filter((m) => !have.has(m.id))
        .map((m) => ({
          accountNumber: "", basis: "", notes: "", lastDisputeDate: "",
          status: "Not started", round: 1, ...m,
        }));
      return [...xs, ...additions];
    });
    setTab("items");
  };

  const fonts = (
    <link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,560;9..144,640&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" />
  );

  /* --- item helpers --- */
  const addItem = () => setItems((xs) => [...xs, {
    id: uid(), creditor: "", accountNumber: "", type: "Collection",
    bureaus: { equifax: true, experian: true, transunion: true },
    dateReported: "", dofd: "", balance: "", basis: "",
    status: "Not started", round: 1, lastDisputeDate: "", notes: "",
  }]);
  const updateItem = (id, patch) => setItems((xs) => xs.map((it) => it.id === id ? { ...it, ...patch } : it));
  const removeItem = (id) => setItems((xs) => xs.filter((it) => it.id !== id));

  /* --- dashboard derived --- */
  const totals = {
    total: items.length,
    byBureau: { equifax: 0, experian: 0, transunion: 0 },
    deleted: items.filter((i) => i.status === "Deleted").length,
    updated: items.filter((i) => i.status === "Updated").length,
    disputed: items.filter((i) => i.status === "Disputed" || i.status === "Escalated").length,
  };
  items.forEach((i) => Object.keys(totals.byBureau).forEach((b) => { if (i.bureaus[b]) totals.byBureau[b]++; }));

  /* --- speed ranking --- */
  function priority(it) {
    if (it.type === "Hard inquiry") return { rank: 1, why: "Unauthorized inquiries are the quickest legitimate removals." };
    if (obsoleteEligible(it)) return { rank: 2, why: "Past the §605 reporting window \u2014 must be deleted." };
    if (it.type === "Collection") return { rank: 3, why: "Often thinly documented; demand verification." };
    if (/duplicate/i.test(it.basis || "")) return { rank: 1, why: "True duplicate tradeline \u2014 fast to correct." };
    return { rank: 5, why: "Standard reinvestigation track." };
  }
  const ranked = [...items].map((it) => ({ it, ...priority(it) })).sort((a, b) => a.rank - b.rank);

  /* ----------------------------- views ---------------------------------- */
  function Dashboard() {
    const due = items
      .filter((i) => i.lastDisputeDate && (i.status === "Disputed" || i.status === "Escalated"))
      .map((i) => ({ i, when: addDays(parseDate(i.lastDisputeDate) || today(), 30) }))
      .sort((a, b) => a.when - b.when);
    const stat = (label, val, color) => (
      <div className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.mute, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
        <div style={{ fontFamily: display, fontSize: 34, color: color || C.ink, lineHeight: 1.1, marginTop: 4 }}>{val}</div>
      </div>
    );
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          {stat("Negative items", totals.total)}
          {stat("Deleted", totals.deleted, C.accent)}
          {stat("Updated", totals.updated, C.amber)}
          {stat("In dispute", totals.disputed, C.accent)}
        </div>

        <div className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.mute, textTransform: "uppercase", letterSpacing: ".06em" }}>Items reporting per bureau</div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            {Object.entries(BUREAUS).map(([k, b]) => (
              <div key={k} className="rounded-lg p-3" style={{ background: C.surface }}>
                <div style={{ fontSize: 12, color: C.ink2, fontWeight: 600 }}>{b.name.split(" ")[0]}</div>
                <div style={{ fontFamily: display, fontSize: 26, color: C.ink }}>{totals.byBureau[k]}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2" style={{ color: C.ink }}>
            <Clock size={15} /><span style={{ fontFamily: display, fontSize: 17 }}>Next actions due</span>
          </div>
          <p style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>Based on the 30-day FCRA reinvestigation window from your last dispute date.</p>
          {due.length === 0 ? (
            <p style={{ fontSize: 14, color: C.ink2, marginTop: 10 }}>Nothing scheduled. Send a Round 1 dispute and set its date under Tracking to start the clock.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {due.map(({ i, when }) => {
                const overdue = when < today();
                return (
                  <li key={i.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: C.surface }}>
                    <span style={{ fontSize: 13, color: C.ink }}>{i.creditor || "Unnamed item"} <span style={{ color: C.mute }}>\u00b7 R{i.round}</span></span>
                    <Pill color={overdue ? C.clay : C.accent} soft={overdue ? C.claySoft : C.accentSoft}>
                      {overdue ? "follow up \u00b7 " : "by "}{fmtDate(when)}
                    </Pill>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  function Profile() {
    const set = (k) => (e) => setProfile((p) => ({ ...p, [k]: e.target.value }));
    return (
      <div className="space-y-4">
        <p style={{ fontSize: 13, color: C.ink2 }}>
          This is the identity block printed at the top of every letter. Use your legal name and current mailing address.
          Only the last four of your SSN are collected \u2014 that's all a dispute letter should ever include.
        </p>
        <Field label="Full legal name"><input style={inputStyle} value={profile.name} onChange={set("name")} placeholder="Jordan A. Rivera" /></Field>
        <Field label="Street address"><input style={inputStyle} value={profile.address} onChange={set("address")} placeholder="123 Maple Street" /></Field>
        <Field label="City, State ZIP"><input style={inputStyle} value={profile.cityStateZip} onChange={set("cityStateZip")} placeholder="Allentown, PA 18101" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone (optional)"><input style={inputStyle} value={profile.phone} onChange={set("phone")} placeholder="(610) 555-0142" /></Field>
          <Field label="SSN last 4"><input style={inputStyle} maxLength={4} value={profile.ssnLast4} onChange={set("ssnLast4")} placeholder="1234" /></Field>
        </div>
        <Field label="Date of birth"><input style={inputStyle} value={profile.dob} onChange={set("dob")} placeholder="MM/DD/YYYY" /></Field>
      </div>
    );
  }

  function Items() {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p style={{ fontSize: 13, color: C.ink2, maxWidth: 460 }}>
            Add each negative entry. The <b>"What's wrong / your basis"</b> field is the engine of every honest dispute \u2014
            name the actual inaccuracy, the missing proof, or why it can't be verified.
          </p>
          <button onClick={addItem} className="flex items-center gap-1 rounded-lg px-3 py-2 shrink-0"
            style={{ background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} /> Add item
          </button>
        </div>
        {items.length === 0 && (
          <div className="rounded-xl p-6 text-center" style={{ background: C.sheet, border: `1px dashed ${C.line}` }}>
            <p style={{ color: C.mute, fontSize: 14 }}>No items yet. Pull your reports from all three bureaus first, then add what's inaccurate.</p>
          </div>
        )}
        {items.map((it) => {
          const set = (k) => (e) => updateItem(it.id, { [k]: e.target.value });
          const obs = obsoleteEligible(it);
          return (
            <div key={it.id} className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill color={STATUS_COLOR[it.status]} soft={C.surface}>{it.status}</Pill>
                  <Pill color={C.ink2} soft={C.surface}>R{it.round}</Pill>
                  {obs && <Pill color={C.accent} soft={C.accentSoft}>§605 obsolete</Pill>}
                  {it.type === "Hard inquiry" && <Pill color={C.amber} soft={C.amberSoft}>fast track</Pill>}
                </div>
                <button onClick={() => removeItem(it.id)} style={{ color: C.mute }}><Trash2 size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Creditor / furnisher"><input style={inputStyle} value={it.creditor} onChange={set("creditor")} placeholder="Midland Funding" /></Field>
                <Field label="Account number"><input style={inputStyle} value={it.accountNumber} onChange={set("accountNumber")} placeholder="****4471" /></Field>
                <Field label="Type">
                  <select style={inputStyle} value={it.type} onChange={set("type")}>
                    {ITEM_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Balance"><input style={inputStyle} value={it.balance} onChange={set("balance")} placeholder="842.00" /></Field>
                <Field label="Date reported"><input style={inputStyle} value={it.dateReported} onChange={set("dateReported")} placeholder="MM/DD/YYYY" /></Field>
                <Field label="First delinquency (DOFD)" hint={it.type === "Bankruptcy" ? "Bankruptcy: date filed" : "Drives the 7-yr §605 clock"}>
                  <input style={inputStyle} value={it.dofd} onChange={set("dofd")} placeholder="MM/DD/YYYY" />
                </Field>
              </div>
              <div className="mt-3">
                <Field label="Reporting on">
                  <div className="flex gap-3 mt-1">
                    {Object.keys(BUREAUS).map((b) => (
                      <label key={b} className="flex items-center gap-1.5" style={{ fontSize: 13, color: C.ink2 }}>
                        <input type="checkbox" checked={!!it.bureaus[b]}
                          onChange={(e) => updateItem(it.id, { bureaus: { ...it.bureaus, [b]: e.target.checked } })} />
                        {b[0].toUpperCase() + b.slice(1)}
                      </label>
                    ))}
                  </div>
                </Field>
              </div>
              <div className="mt-3">
                <Field label="What's wrong / your basis" hint="Be specific and truthful. e.g. 'Balance shows $842; account was settled in full 3/2023, receipt attached.'">
                  <textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={it.basis} onChange={set("basis")} />
                </Field>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function LetterStudio() {
    const [itemId, setItemId] = useState(items[0]?.id || "");
    const [bureauKey, setBureauKey] = useState("equifax");
    const [round, setRound] = useState(1);
    const [strategy, setStrategy] = useState("reinvestigation");
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);

    const item = items.find((i) => i.id === itemId);
    const suggestion = item
      ? (item.type === "Hard inquiry" ? "reinvestigation"
        : obsoleteEligible(item) ? "obsolescence"
        : item.status === "Verified" ? "mov"
        : "reinvestigation")
      : null;

    const gen = () => {
      if (!item) return;
      setText(buildDisputeLetter({ p: profile, item, bureauKey, round, strategy }));
    };
    const copy = async () => { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch {} };
    const download = () => {
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `dispute_${(item?.creditor || "letter").replace(/\W+/g, "_")}_R${round}.txt`;
      a.click();
    };

    if (items.length === 0) return <Empty msg="Add a negative item first, then come back to generate its letter." />;

    return (
      <div className="space-y-4">
        <div className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Item">
              <select style={inputStyle} value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((i) => <option key={i.id} value={i.id}>{i.creditor || "Unnamed"} \u00b7 {i.type}</option>)}
              </select>
            </Field>
            <Field label="Round">
              <select style={inputStyle} value={round} onChange={(e) => setRound(Number(e.target.value))}>
                <option value={1}>Round 1 \u00b7 initial</option>
                <option value={2}>Round 2 \u00b7 escalation</option>
                <option value={3}>Round 3+ \u00b7 demand</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Send to">
              <select style={inputStyle} value={bureauKey} onChange={(e) => setBureauKey(e.target.value)} disabled={strategy === "furnisher"}>
                {Object.entries(BUREAUS).map(([k, b]) => <option key={k} value={k}>{b.name.split(" ")[0]}</option>)}
              </select>
            </Field>
            <Field label="Strategy">
              <select style={inputStyle} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                {STRATEGIES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Field>
          </div>
          <p style={{ fontSize: 12.5, color: C.mute, marginTop: 10 }}>
            {STRATEGIES.find((s) => s.key === strategy)?.blurb}
          </p>
          {suggestion && suggestion !== strategy && (
            <button onClick={() => setStrategy(suggestion)} className="mt-2 flex items-center gap-1"
              style={{ color: C.accent, fontSize: 12.5, fontWeight: 600 }}>
              <Info size={13} /> Suggested for this item: {STRATEGIES.find((s) => s.key === suggestion)?.label}
            </button>
          )}
          {item && !item.basis && strategy !== "obsolescence" && strategy !== "procedural" && strategy !== "mov" && (
            <div className="mt-3 flex gap-2 rounded-lg p-2.5" style={{ background: C.amberSoft }}>
              <AlertTriangle size={15} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 12.5, color: C.ink2 }}>This item has no stated basis. A dispute with no genuine basis can be dismissed as frivolous under §611(a)(3) \u2014 add the specific inaccuracy under Items first.</span>
            </div>
          )}
          <button onClick={gen} className="mt-3 flex items-center justify-center gap-2 w-full rounded-lg py-2.5"
            style={{ background: C.ink, color: C.paper, fontSize: 14, fontWeight: 600 }}>
            <FileText size={16} /> Generate letter
          </button>
        </div>

        {text && (
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between px-3 py-2" style={{ background: C.surface }}>
              <span style={{ fontFamily: mono, fontSize: 11, color: C.mute, letterSpacing: ".05em" }}>PRINT-READY \u00b7 EDITABLE</span>
              <div className="flex gap-2">
                <button onClick={copy} className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: C.sheet, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink2 }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}{copied ? "Copied" : "Copy"}
                </button>
                <button onClick={download} className="flex items-center gap-1 rounded-md px-2 py-1" style={{ background: C.sheet, border: `1px solid ${C.line}`, fontSize: 12, color: C.ink2 }}>
                  <Download size={13} /> .txt
                </button>
              </div>
            </div>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              style={{
                width: "100%", minHeight: 460, resize: "vertical", border: "none", outline: "none",
                background: C.sheet, color: C.ink, padding: "28px 30px",
                fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
              }}
            />
          </div>
        )}
      </div>
    );
  }

  function Negotiation() {
    const [mode, setMode] = useState("goodwill");
    const [itemId, setItemId] = useState(items[0]?.id || "");
    const [offer, setOffer] = useState("");
    const [text, setText] = useState("");
    const item = items.find((i) => i.id === itemId);
    if (items.length === 0) return <Empty msg="Add an item first to draft a goodwill or pay-for-delete letter." />;
    const gen = () => {
      if (!item) return;
      setText(mode === "goodwill" ? buildGoodwillLetter({ p: profile, item })
        : buildPayForDeleteLetter({ p: profile, item, offer: offer ? Number(offer) : null }));
    };
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {[["goodwill", "Goodwill", Handshake], ["pfd", "Pay-for-delete", Scale]].map(([k, label, Icon]) => (
            <button key={k} onClick={() => { setMode(k); setText(""); }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2"
              style={{ background: mode === k ? C.ink : C.sheet, color: mode === k ? C.paper : C.ink2, border: `1px solid ${mode === k ? C.ink : C.line}`, fontSize: 13, fontWeight: 600 }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {mode === "goodwill" ? (
          <div className="flex gap-2 rounded-lg p-3" style={{ background: C.accentSoft }}>
            <ShieldCheck size={16} style={{ color: C.accent, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: C.ink2 }}>Best for an accurate, isolated late payment on an account you've otherwise paid on time. It's a favor, not a right \u2014 keep it gracious.</span>
          </div>
        ) : (
          <div className="flex gap-2 rounded-lg p-3" style={{ background: C.amberSoft }}>
            <AlertTriangle size={16} style={{ color: C.amber, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12.5, color: C.ink2 }}>Reality check: bureaus discourage pay-for-delete and furnishers don't have to honor it. <b>Get the agreement in writing before paying.</b> Paying can also restart the clock on time-barred debt in some states \u2014 confirm yours first.</span>
          </div>
        )}

        <div className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
          <Field label="Item">
            <select style={inputStyle} value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {items.map((i) => <option key={i.id} value={i.id}>{i.creditor || "Unnamed"} \u00b7 {i.type}</option>)}
            </select>
          </Field>
          {mode === "pfd" && (
            <div className="mt-3">
              <Field label="Settlement offer" hint="Common opening: 25\u201350% of the balance.">
                <input style={inputStyle} value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="300" />
              </Field>
            </div>
          )}
          <button onClick={gen} className="mt-3 flex items-center justify-center gap-2 w-full rounded-lg py-2.5"
            style={{ background: C.ink, color: C.paper, fontSize: 14, fontWeight: 600 }}>
            <FileText size={16} /> Generate letter
          </button>
        </div>

        {text && (
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
            style={{
              width: "100%", minHeight: 420, resize: "vertical", borderRadius: 12, border: `1px solid ${C.line}`,
              background: C.sheet, color: C.ink, padding: "26px 28px",
              fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap",
            }} />
        )}
      </div>
    );
  }

  function Tracking() {
    if (items.length === 0) return <Empty msg="No items to track yet." />;
    return (
      <div className="space-y-3">
        <p style={{ fontSize: 13, color: C.ink2 }}>Log each round. Setting a dispute date starts the 30-day clock shown on the dashboard.</p>
        {items.map((it) => (
          <div key={it.id} className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
            <div className="flex items-center justify-between">
              <span style={{ fontFamily: display, fontSize: 16, color: C.ink }}>{it.creditor || "Unnamed item"}</span>
              <Pill color={STATUS_COLOR[it.status]} soft={C.surface}>{it.status}</Pill>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <Field label="Status">
                <select style={inputStyle} value={it.status} onChange={(e) => updateItem(it.id, { status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Round">
                <select style={inputStyle} value={it.round} onChange={(e) => updateItem(it.id, { round: Number(e.target.value) })}>
                  {[1, 2, 3, 4].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Last dispute date">
                <input style={inputStyle} value={it.lastDisputeDate} onChange={(e) => updateItem(it.id, { lastDisputeDate: e.target.value })} placeholder="MM/DD/YYYY" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Notes (responses, dates, tracking #s)">
                <textarea style={{ ...inputStyle, minHeight: 52, resize: "vertical" }} value={it.notes} onChange={(e) => updateItem(it.id, { notes: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function Strategy() {
    const steps = [
      ["Lower your utilization first", "Not a letter at all, but the single fastest score lever. Paying revolving balances below ~30% (ideally <10%) can move a score within one reporting cycle. Do this in parallel with everything else."],
      ["Unauthorized hard inquiries", "Inquiries you never authorized come off fastest. Dispute the ones you don't recognize; legitimate ones fall off on their own at two years."],
      ["Genuinely obsolete items (§605)", "Anything past the 7-year window (10 for bankruptcy) must be deleted. The app flags these automatically once you set a first-delinquency date."],
      ["True duplicate tradelines", "The same debt listed twice (e.g. original creditor + collector both showing a balance) is a real inaccuracy and usually a quick fix."],
      ["Thinly-documented collections", "Demand verification of accuracy and completeness. If the furnisher can't substantiate it, it must be deleted."],
      ["Goodwill for isolated lates", "For accurate one-off late payments on otherwise-clean accounts, a goodwill letter to the creditor is often faster than a dispute."],
    ];
    const myPlan = ranked.filter(({ rank }) => rank <= 4);
    return (
      <div className="space-y-5">
        <div className="rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
          <div className="flex gap-2">
            <Scale size={16} style={{ color: C.accent, flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 13, color: C.ink2 }}>
              The fastest results that hold up come from removing things that are actually <b>inaccurate, unverifiable, or expired</b> \u2014
              not from out-disputing the verification system. Work the order below.
            </p>
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map(([t, d], i) => (
            <li key={i} className="flex gap-3 rounded-xl p-4" style={{ background: C.sheet, border: `1px solid ${C.line}` }}>
              <span style={{ fontFamily: mono, fontSize: 13, color: C.accent, fontWeight: 500, marginTop: 1 }}>{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div style={{ fontFamily: display, fontSize: 16, color: C.ink }}>{t}</div>
                <p style={{ fontSize: 13, color: C.ink2, marginTop: 3 }}>{d}</p>
              </div>
            </li>
          ))}
        </ol>

        {myPlan.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: C.ink }}>
            <div style={{ fontFamily: display, fontSize: 17, color: C.paper }}>Your suggested sequence</div>
            <ul className="mt-3 space-y-2">
              {myPlan.map(({ it, why }) => (
                <li key={it.id} className="flex items-start gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <ChevronRight size={15} style={{ color: C.accent, marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <span style={{ color: C.paper, fontSize: 13.5, fontWeight: 600 }}>{it.creditor || "Unnamed"} <span style={{ color: "#9aa0a8", fontWeight: 400 }}>\u00b7 {it.type}</span></span>
                    <p style={{ color: "#b7bcc3", fontSize: 12.5 }}>{why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  function Empty({ msg }) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: C.sheet, border: `1px dashed ${C.line}` }}>
        <p style={{ color: C.mute, fontSize: 14 }}>{msg}</p>
      </div>
    );
  }

  const TABS = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["profile", "Profile", User],
    ["monitoring", "Monitoring", Activity],
    ["items", "Items", ListChecks],
    ["letter", "Letters", Send],
    ["negotiation", "Goodwill / PFD", Handshake],
    ["tracking", "Tracking", FileText],
    ["strategy", "Fast track", Gauge],
  ];

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", background: C.paper, display: "grid", placeItems: "center", fontFamily: body, color: C.mute }}>
        {fonts}Loading your docket…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.paper, fontFamily: body, color: C.ink }}>
      {fonts}
      {/* header */}
      <header style={{ background: C.ink, color: C.paper, padding: "18px 18px 16px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: ".18em", color: "#8b9aa0" }}>FCRA DISPUTE WORKBENCH</div>
              <h1 style={{ fontFamily: display, fontSize: 27, lineHeight: 1.05, marginTop: 2 }}>Credit Docket</h1>
            </div>
            <button onClick={() => setShowGuide(true)} className="flex items-center gap-1 rounded-lg px-3 py-2"
              style={{ background: "rgba(255,255,255,0.08)", color: C.paper, fontSize: 12.5 }}>
              <Info size={14} /> Use it right
            </button>
          </div>
        </div>
      </header>

      {/* tab strip */}
      <nav style={{ background: C.surface, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", gap: 4, overflowX: "auto", padding: "8px 12px" }}>
          {TABS.map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 shrink-0"
              style={{
                background: tab === k ? C.ink : "transparent",
                color: tab === k ? C.paper : C.ink2,
                fontSize: 13, fontWeight: tab === k ? 600 : 500, whiteSpace: "nowrap",
              }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </nav>

      <main style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 60px" }}>
        {tab === "dashboard" && <Dashboard />}
        {tab === "profile" && <Profile />}
        {tab === "monitoring" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ReportUpload onImport={importBureauItems} />
            <MonitoringPanel sender={profile} onImport={importBureauItems} />
          </div>
        )}
        {tab === "items" && <Items />}
        {tab === "letter" && <LetterStudio />}
        {tab === "negotiation" && <Negotiation />}
        {tab === "tracking" && <Tracking />}
        {tab === "strategy" && <Strategy />}
      </main>

      {/* guide modal */}
      {showGuide && (
        <div onClick={() => setShowGuide(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(22,25,31,0.5)", display: "grid", placeItems: "center", padding: 16, zIndex: 20 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.paper, borderRadius: 16, maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto", padding: "22px 22px 26px" }}>
            <div className="flex items-center justify-between">
              <h2 style={{ fontFamily: display, fontSize: 21, color: C.ink }}>How to use this without getting burned</h2>
              <button onClick={() => setShowGuide(false)} style={{ color: C.mute }}><X size={20} /></button>
            </div>
            <div className="space-y-3 mt-3" style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6 }}>
              <p><b>Dispute what's actually wrong.</b> Your power under FCRA §611 is real: bureaus must delete information they can't verify as accurate and complete. Every letter here is built around a basis you state \u2014 keep it truthful.</p>
              <p><b>Don't try to out-spam verification.</b> Filing disputes with no genuine basis, or rewording the same baseless claim each round to dodge filters, can be dismissed as frivolous (§611(a)(3)) and is the behavior regulators target. It also rarely works \u2014 bureaus run automated verification.</p>
              <p><b>Always mail certified, return receipt.</b> The dated proof is what makes a §611(a)(1) "missed the 30 days" argument stick later.</p>
              <p><b>Keep records.</b> Save every letter and response in Tracking. If a bureau or furnisher breaks the rules, that paper trail is what an attorney or a CFPB complaint runs on.</p>
              <p><b>If you ever sell this as a service,</b> the Credit Repair Organizations Act applies: no charging before work is delivered, no misrepresentations, written contracts, and a 3-day cancellation right. Worth a real lawyer's review before you take a dollar.</p>
              <p style={{ color: C.mute, fontSize: 12.5 }}>This tool drafts letters and organizes your case. It isn't legal advice, and using it doesn't create an attorney-client relationship.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
