// reportParser.js — turn an uploaded credit report into candidate items,
// entirely in the browser (the file never leaves the user's machine).
//
// Three input paths:
//   1. JSON  — an API CreditProfile ({tradelines,...}) or an array of items.
//              Deterministic; mapped exactly.
//   2. PDF   — text extracted with pdf.js, then heuristically scanned.
//   3. HTML / text — text read directly, then heuristically scanned.
//
// The heuristic scan is BEST EFFORT. Report layouts differ across bureaus and
// services, so it produces *candidates* to review and correct — never trusted
// output. Every item comes back needsReview:true.

import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { mapProfileToItems } from "./mapProfile.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const uid = () =>
  (globalThis.crypto?.randomUUID?.() || "id-" + Math.random().toString(36).slice(2, 10));

const NEG = [
  { re: /charge[\s-]?off/i, type: "Charge-off" },
  { re: /collection/i, type: "Collection" },
  { re: /repossess/i, type: "Repossession" },
  { re: /foreclos/i, type: "Foreclosure" },
  { re: /bankrupt/i, type: "Bankruptcy" },
  { re: /\b(30|60|90|120|150|180)\s*(day|days)?\s*(late|past due)/i, type: "Late payment" },
  { re: /past\s*due|derogatory|\bdelinquent\b/i, type: "Late payment" },
];

const DATE = /\b(0?[1-9]|1[0-2])[\/\-.](\d{4}|\d{2})\b|\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b/i;
const MONEY = /\$\s?([\d,]+(?:\.\d{2})?)/;
const ACCT = /(?:acct|account)\s*(?:#|no\.?|number)?\s*[:#]?\s*([xX*\d][xX*\d\- ]{3,})/i;

function detectBureaus(window) {
  const b = { equifax: false, experian: false, transunion: false };
  if (/equifax/i.test(window)) b.equifax = true;
  if (/experian/i.test(window)) b.experian = true;
  if (/trans\s?union/i.test(window)) b.transunion = true;
  // If none named near the item, default to all three so it's usable; user verifies.
  if (!b.equifax && !b.experian && !b.transunion) return { equifax: true, experian: true, transunion: true };
  return b;
}

function looksLikeName(line) {
  const s = line.trim();
  if (s.length < 3 || s.length > 60) return false;
  if (/^(account|balance|status|date|payment|reported|high|type|terms|remarks)\b/i.test(s)) return false;
  return /[A-Za-z]{3,}/.test(s) && (s === s.toUpperCase() || /[A-Z][a-z]/.test(s));
}

/** Extract plain text from a File (PDF, HTML, or text-like). */
export async function extractText(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let out = "";
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      out += content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
    }
    return out;
  }
  const text = await file.text();
  if (name.endsWith(".html") || name.endsWith(".htm") || /^\s*</.test(text)) {
    const doc = new DOMParser().parseFromString(text, "text/html");
    return doc.body ? doc.body.textContent || "" : text;
  }
  return text;
}

/** Heuristic scan of extracted text → candidate items. Best effort. */
export function scanText(text) {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim());
  const candidates = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Don't let field labels (e.g. "Date of First Delinquency") act as anchors.
    if (/first delinquency|delinquency date/i.test(line)) continue;
    const hit = NEG.find((n) => n.re.test(line));
    if (!hit) continue;

    // Look at a small window around the anchor line for the other fields.
    const win = lines.slice(Math.max(0, i - 4), i + 5).join(" ");

    let creditor = "";
    for (let k = i; k >= Math.max(0, i - 4); k--) {
      if (looksLikeName(lines[k]) && !NEG.some((n) => n.re.test(lines[k]))) { creditor = lines[k]; break; }
    }
    const balance = (win.match(MONEY) || [])[1]?.replace(/,/g, "") || "";
    const acct = (win.match(ACCT) || [])[1]?.trim() || "";
    const dofd = (win.match(DATE) || [])[0] || "";

    const key = `${creditor}|${hit.type}|${balance}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    candidates.push({
      id: uid(),
      source: "upload",
      creditor: creditor || "(review — creditor not detected)",
      accountNumber: acct,
      type: hit.type,
      bureaus: detectBureaus(win),
      dateReported: "",
      dofd: dofd ? dofd : "",
      balance: balance ? Number(balance) : "",
      basis: "",
      status: "Not started",
      round: 1,
      needsReview: true,
    });
  }
  return candidates;
}

/** Full pipeline for a File. Returns { items, warnings }. */
export async function parseFile(file) {
  const raw = await extractText(file);
  return parseText(raw, file.name || "");
}

/** Parse already-extracted text (also used by the paste-text box). */
export function parseText(raw, filename = "") {
  const trimmed = raw.trim();

  // JSON path — deterministic.
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);
      if (data && Array.isArray(data.tradelines)) {
        return { items: mapProfileToItems(data).map((it) => ({ ...it, source: "upload", needsReview: true })), warnings: [] };
      }
      if (Array.isArray(data)) {
        const items = data.map((d) => ({
          id: d.id || uid(), source: "upload", creditor: d.creditor || d.creditorName || "",
          accountNumber: d.accountNumber || d.accountNumberMasked || "", type: d.type || "Other",
          bureaus: d.bureaus || { equifax: true, experian: true, transunion: true },
          dateReported: d.dateReported || "", dofd: d.dofd || d.dateOfFirstDelinquency || "",
          balance: d.balance ?? "", basis: d.basis || "", status: "Not started", round: 1, needsReview: true,
        }));
        return { items, warnings: [] };
      }
    } catch {
      return { items: [], warnings: ["The file looked like JSON but could not be parsed."] };
    }
  }

  // Heuristic path.
  const items = scanText(raw);
  const warnings = [];
  if (items.length === 0) {
    warnings.push("No negative items were detected automatically. This parser is approximate — you can still add items by hand in the Items tab, or paste the relevant section.");
  } else {
    warnings.push(`Detected ${items.length} candidate item(s) from ${filename || "the report"}. This is a best-effort parse — verify every field before adding, and fill in the basis for each dispute.`);
  }
  return { items, warnings };
}
