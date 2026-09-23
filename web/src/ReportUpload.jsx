// ReportUpload.jsx — upload or paste a credit report, review parsed candidates,
// then add them to the workspace. All parsing is client-side.

import React, { useState, useRef } from "react";
import { parseFile, parseText } from "./reportParser.js";

const C = {
  ink: "#16191F", ink2: "#3A4049", sheet: "#FFFEFB", surface: "#F4F1E9",
  line: "#E2DCCE", accent: "#0F6E5C", clay: "#A8392E", claySoft: "#F4E2DE",
  amber: "#9A6B12", amberSoft: "#F3E9D2", mute: "#7B7363",
};
const mono = "'IBM Plex Mono', ui-monospace, monospace";
const box = { background: C.sheet, border: `1px solid ${C.line}`, borderRadius: 12 };
const input = { width: "100%", background: C.sheet, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: C.ink, outline: "none" };
const TYPES = ["Late payment", "Collection", "Charge-off", "Repossession", "Bankruptcy", "Hard inquiry", "Foreclosure", "Tax lien", "Other"];

export default function ReportUpload({ onImport }) {
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [error, setError] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    setError(""); setBusy(true); setItems([]); setWarnings([]);
    try {
      const { items, warnings } = await parseFile(file);
      setItems(items); setWarnings(warnings);
    } catch (e) {
      setError(e?.message || "Could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  function handlePaste() {
    setError("");
    const { items, warnings } = parseText(pasteText, "pasted text");
    setItems(items); setWarnings(warnings);
  }

  function patch(id, p) { setItems((xs) => xs.map((it) => (it.id === id ? { ...it, ...p } : it))); }
  function remove(id) { setItems((xs) => xs.filter((it) => it.id !== id)); }

  function addAll() {
    if (onImport && items.length) onImport(items);
    setItems([]); setWarnings([]); setPasteText("");
  }

  return (
    <div style={{ ...box, padding: 16 }}>
      <div style={{ fontFamily: mono, fontSize: 11, color: C.mute, letterSpacing: ".06em", textTransform: "uppercase" }}>Import from a report file</div>
      <p style={{ fontSize: 12.5, color: C.mute, marginTop: 4 }}>
        Upload a report from AnnualCreditReport.com or a monitoring service (PDF, HTML, text, or JSON).
        Parsing happens in your browser — the file is never uploaded. Results are a starting point to review.
      </p>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{ marginTop: 10, border: `1.5px dashed ${C.line}`, borderRadius: 10, padding: 20, textAlign: "center", cursor: "pointer", background: C.surface }}
      >
        <div style={{ fontSize: 13.5, color: C.ink2 }}>{busy ? "Reading…" : "Drop a report here, or click to choose a file"}</div>
        <div style={{ fontSize: 11.5, color: C.mute, marginTop: 3 }}>.pdf · .html · .txt · .json</div>
        <input ref={fileRef} type="file" accept=".pdf,.html,.htm,.txt,.json,application/pdf" style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>

      <button onClick={() => setShowPaste((s) => !s)}
        style={{ marginTop: 8, background: "none", border: "none", color: C.accent, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
        {showPaste ? "Hide paste box" : "…or paste report text instead"}
      </button>
      {showPaste && (
        <div style={{ marginTop: 8 }}>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste the accounts / collections section of your report…"
            style={{ ...input, minHeight: 90, resize: "vertical" }} />
          <button onClick={handlePaste} disabled={!pasteText.trim()}
            style={{ marginTop: 6, background: C.ink, color: "#FBF8F1", border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: pasteText.trim() ? 1 : 0.5 }}>
            Parse pasted text
          </button>
        </div>
      )}

      {error && <div style={{ marginTop: 10, padding: 10, background: C.claySoft, borderRadius: 8, color: C.clay, fontSize: 13 }}>{error}</div>}
      {warnings.map((w, i) => (
        <div key={i} style={{ marginTop: 10, padding: 10, background: C.amberSoft, borderRadius: 8, color: C.ink2, fontSize: 12.5 }}>{w}</div>
      ))}

      {items.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: C.ink, fontWeight: 600 }}>Review {items.length} parsed item(s)</span>
            <button onClick={addAll}
              style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Add all to workspace
            </button>
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((it) => (
              <div key={it.id} style={{ background: C.surface, borderRadius: 10, padding: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <input style={input} value={it.creditor} onChange={(e) => patch(it.id, { creditor: e.target.value })} placeholder="Creditor / furnisher" />
                  <input style={input} value={it.accountNumber} onChange={(e) => patch(it.id, { accountNumber: e.target.value })} placeholder="Account #" />
                  <select style={input} value={it.type} onChange={(e) => patch(it.id, { type: e.target.value })}>
                    {TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input style={input} value={it.balance} onChange={(e) => patch(it.id, { balance: e.target.value })} placeholder="Balance" />
                  <input style={input} value={it.dofd} onChange={(e) => patch(it.id, { dofd: e.target.value })} placeholder="First delinquency (MM/YYYY)" />
                  <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: C.ink2 }}>
                    {["equifax", "experian", "transunion"].map((b) => (
                      <label key={b} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                        <input type="checkbox" checked={!!it.bureaus[b]} onChange={(e) => patch(it.id, { bureaus: { ...it.bureaus, [b]: e.target.checked } })} />
                        {b[0].toUpperCase() + b.slice(1, 3)}
                      </label>
                    ))}
                  </div>
                </div>
                <textarea style={{ ...input, marginTop: 8, minHeight: 46, resize: "vertical" }}
                  value={it.basis} onChange={(e) => patch(it.id, { basis: e.target.value })}
                  placeholder="What's wrong / your basis (required before a factual-claim letter)…" />
                <button onClick={() => remove(it.id)}
                  style={{ marginTop: 6, background: "none", border: "none", color: C.clay, fontSize: 12, cursor: "pointer", padding: 0 }}>
                  Discard this item
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
