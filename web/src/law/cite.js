// web/src/law/cite.js
// Frontend citation renderer. Imports the generated mirror bundle produced by
// the backend's `npm run build:law` (src/shared/law/generated/law.json), so the
// client and server render from the exact same registry — no drift.

import lawBundle from "../../../src/shared/law/generated/law.json";

export const CITATIONS = lawBundle.citations;
export const REASON_CITATIONS = lawBundle.reason_citations;
export const LAW_VERSION = lawBundle.version;

/**
 * "§611(a)(1)(A) of the FCRA (15 U.S.C. §1681i)" (with a subsection)
 * "§605 of the FCRA (15 U.S.C. §1681c)"          (without)
 * Uses each section's Act, so FDCPA sections read "of the FDCPA".
 */
export function citeInProse(section, sub) {
  const c = CITATIONS[section];
  if (!c) return "";
  if (sub && c.subsections && c.subsections[sub]) {
    return `${c.short}${c.subsections[sub].label} of the ${c.act} (${c.usc})`;
  }
  return `${c.short} of the ${c.act} (${c.usc})`;
}
