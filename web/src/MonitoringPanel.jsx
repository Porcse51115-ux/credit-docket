// MonitoringPanel.jsx — drop-in Credit Docket tab that connects the dashboard to
// the monitoring API. Pull tri-bureau data, review items, pick a reason (+ basis
// where the claim is factual), and generate letters through the backend engine —
// which enforces the same frivolous-basis guard as the rest of the app.
//
// Usage inside CreditDocket:
//   import MonitoringPanel from "../web/MonitoringPanel.jsx";
//   {tab === "monitoring" && <MonitoringPanel sender={profile} />}
// (add ["monitoring","Monitoring",Activity] to the TABS array)

import React, { useState } from "react";
import { pullReport, generateLetters } from "./creditApi.js";
import { mapProfileToItems } from "./mapProfile.js";

const C = {
  ink: "#16191F", ink2: "#3A4049", paper: "#FBF8F1", sheet: "#FFFEFB",
  surface: "#F4F1E9", line: "#E2DCCE", accent: "#0F6E5C", accentSoft: "#E4F0EB",
  clay: "#A8392E", claySoft: "#F4E2DE", amber: "#9A6B12", amberSoft: "#F3E9D2", mute: "#7B7363",
};
const mono = "'IBM Plex Mono', ui-monospace, monospace";

// Reason codes must match the backend DisputeReasonCode union.
const REASONS = [
  ["unverifiable", "Request verification (§611)"],
  ["outdated", "Obsolete (§605)"],
  ["not_mine", "Not mine"],
  ["incorrect_balance", "Incorrect balance"],
  ["paid_in_full", "Paid / settled"],
  ["never_late", "Never late"],
  ["duplicate", "Duplicate tradeline"],
  ["incorrect_status", "Incorrect status"],
  ["unauthorized_inquiry", "Unauthorized inquiry"],
];
const FACTUAL = new Set(["not_mine", "incorrect_balance", "paid_in_full", "never_late", "duplicate", "incorrect_status", "unauthorized_inquiry"]);

function defaultReason(item) {
  if (item.type === "Hard inquiry") return "unauthorized_inquiry";
  if ((item.signals || []).includes("past_reporting_window")) return "outdated";
  return "unverifiable";
}

const box = { background: C.sheet, border: `1px solid ${C.line}`, borderRadius: 12 };
const input = { width: "100%", background: C.sheet, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.ink, outline: "none" };

export default function MonitoringPanel({ sender = {}, defaultConsumerId = "consumer_001", onImport }) {
  const [consumerId, setConsumerId] = useState(defaultConsumerId);
  const [consentToken, setConsentToken] = useState("");
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState({}); // itemId -> { on, reason, assertion }
  const [status, setStatus] = useState(null); // { partial, diagnostics }
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { letters, skipped }

  async function onPull() {
    setError(""); setResult(null); setLoading(true);
    try {
      const { partial, diagnostics, profile } = await pullReport(consumerId, consentToken || "demo-consent");
      const mapped = mapProfileToItems(profile);
      setItems(mapped);
      setStatus({ partial, diagnostics });
      const s = {};
      for (const it of mapped) s[it.id] = { on: false, reason: defaultReason(it), assertion: it.suggestedBasis || "" };
      setSel(s);
    } catch (e) {
      setError(e.message || "pull failed");
    } finally {
      setLoading(false);
    }
  }

  function patch(id, p) { setSel((s) => ({ ...s, [id]: { ...s[id], ...p } })); }

  async function onGenerate() {
    setError(""); setResult(null); setGenerating(true);
    try {
      const disputes = items
        .filter((it) => sel[it.id]?.on)
        .map((it) => {
          const s = sel[it.id];
          const d = { itemId: it.id, reason: s.reason };
          if (s.assertion && s.assertion.trim()) d.assertion = s.assertion.trim();
          return d;
        });
      if (disputes.length === 0) { setError("Select at least one item to dispute."); return; }
      const res = await generateLetters(consumerId, sender, disputes);
      setResult(res);
    } catch (e) {
      setError(e.message || "letter generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const selectedCount = items.filter((it) => sel[it.id]?.on).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* pull controls */}
      <div style={{ ...box, padding: 16 }}>
        <div style={{ fontFamily: mono, fontSize: 11, color: C.mute, letterSpacing: ".06em", textTransform: "uppercase" }}>Pull credit data</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <input style={input} value={consumerId} onChange={(e) => setConsumerId(e.target.value)} placeholder="consumer id" />
          <input style={input} value={consentToken} onChange={(e) => setConsentToken(e.target.value)} placeholder="consent token" />
        </div>
        <button onClick={onPull} disabled={loading}
          style={{ marginTop: 10, background: C.ink, color: C.paper, border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Pulling…" : "Pull from all bureaus"}
        </button>
        {status && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: status.partial ? C.amber : C.accent }}>
            {status.partial
              ? `Partial pull — ${status.diagnostics.filter((d) => !d.ok).map((d) => d.bureau).join(", ")} did not return.`
              : "All three bureaus returned."}
          </div>
        )}
      </div>

      {error && <div style={{ ...box, padding: 12, background: C.claySoft, borderColor: C.clay, color: C.clay, fontSize: 13 }}>{error}</div>}

      {/* items */}
      {items.length > 0 && (
        <div style={{ ...box, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: mono, fontSize: 11, color: C.mute, letterSpacing: ".06em", textTransform: "uppercase" }}>Review &amp; select ({selectedCount} selected)</div>
            <div style={{ display: "flex", gap: 8 }}>
              {onImport && (
                <button onClick={() => onImport(items)}
                  style={{ background: C.sheet, color: C.ink2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Add to workspace
                </button>
              )}
              <button onClick={onGenerate} disabled={generating || selectedCount === 0}
                style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: generating || selectedCount === 0 ? 0.5 : 1 }}>
                {generating ? "Generating…" : "Generate letters"}
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => {
              const s = sel[it.id] || {};
              const needsBasis = FACTUAL.has(s.reason) && !(s.assertion && s.assertion.trim());
              return (
                <div key={it.id} style={{ background: C.surface, borderRadius: 10, padding: 12 }}>
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!s.on} onChange={(e) => patch(it.id, { on: e.target.checked })} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: C.ink, fontWeight: 600 }}>
                        {it.creditor} <span style={{ color: C.mute, fontWeight: 400 }}>· {it.type}{it.accountNumber ? ` · ${it.accountNumber}` : ""}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.mute, marginTop: 2 }}>
                        {Object.keys(it.bureaus).filter((b) => it.bureaus[b]).join(" / ") || "—"}
                        {it.signals?.length ? ` · ${it.signals.join(", ")}` : ""}
                      </div>
                      {it.suggestedBasis && <div style={{ fontSize: 12, color: C.amber, marginTop: 4 }}>{it.suggestedBasis}</div>}
                    </div>
                  </label>

                  {s.on && (
                    <div style={{ marginTop: 10, paddingLeft: 30, display: "flex", flexDirection: "column", gap: 8 }}>
                      <select style={{ ...input, maxWidth: 280 }} value={s.reason} onChange={(e) => patch(it.id, { reason: e.target.value })}>
                        {REASONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                      {FACTUAL.has(s.reason) && (
                        <textarea style={{ ...input, minHeight: 54, resize: "vertical" }}
                          value={s.assertion || ""} onChange={(e) => patch(it.id, { assertion: e.target.value })}
                          placeholder="State your factual basis (required for this reason)…" />
                      )}
                      {needsBasis && <div style={{ fontSize: 12, color: C.clay }}>This reason is a factual claim — add a basis or the backend will skip it (frivolous risk, §611(a)(3)).</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* results */}
      {result && (
        <div style={{ ...box, padding: 16 }}>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.mute, letterSpacing: ".06em", textTransform: "uppercase" }}>
            {result.letters.length} letter(s) generated · {result.skipped.length} skipped
          </div>
          {result.skipped.map((s, i) => (
            <div key={i} style={{ marginTop: 8, fontSize: 12.5, color: C.clay }}>skipped: {s.reason}</div>
          ))}
          {result.letters.map((l, i) => (
            <div key={i} style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12.5, color: C.ink2, fontWeight: 600 }}>{l.bureau} · {l.reason}</span>
                <button onClick={() => navigator.clipboard?.writeText(l.text)}
                  style={{ background: C.sheet, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 8px", fontSize: 12, color: C.ink2, cursor: "pointer" }}>Copy</button>
              </div>
              <textarea readOnly value={l.text}
                style={{ width: "100%", minHeight: 240, marginTop: 6, borderRadius: 8, border: `1px solid ${C.line}`, background: C.sheet, color: C.ink, padding: "16px 18px", fontFamily: "'Iowan Old Style', Georgia, serif", fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
