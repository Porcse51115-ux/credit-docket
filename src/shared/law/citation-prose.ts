// src/shared/law/citation-prose.ts
import { CITATIONS, StatuteSection } from "./citations";
import { REASON_CITATIONS, DisputeReasonCode } from "./reason-map";

/**
 * Render a citation as inline prose, e.g.
 *   "§611(a)(1)(A) of the FCRA (15 U.S.C. §1681i)"  (with a subsection)
 *   "§605 of the FCRA (15 U.S.C. §1681c)"           (without)
 * Uses each section's own Act, so FDCPA sections read "of the FDCPA".
 * If a subsection is given but not found, falls back to the parent citation.
 */
export function citeInProse(section: StatuteSection, sub?: string): string {
  const c = CITATIONS[section];
  if (!c) throw new Error(`Unknown citation: ${section}`);
  if (sub && c.subsections?.[sub]) {
    return `${c.short}${c.subsections[sub].label} of the ${c.act} (${c.usc})`;
  }
  return `${c.short} of the ${c.act} (${c.usc})`;
}

/** Just the short cite, e.g. "§611(a)(1)(A)" — for lists where the act is named nearby. */
export function citeShort(section: StatuteSection, sub?: string): string {
  const c = CITATIONS[section];
  if (!c) throw new Error(`Unknown citation: ${section}`);
  if (sub && c.subsections?.[sub]) return `${c.short}${c.subsections[sub].label}`;
  return c.short;
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** Primary citation for a reason, expanding its subsections if it has any. */
export function citeReasonPrimary(reason: DisputeReasonCode): string {
  const plan = REASON_CITATIONS[reason];
  const subs = plan.primary_subsections;
  if (subs && subs.length) return joinAnd(subs.map((s) => citeInProse(plan.primary, s)));
  return citeInProse(plan.primary);
}

/** Supporting citations for a reason, or "". */
export function citeReasonSupporting(reason: DisputeReasonCode): string {
  const sup = REASON_CITATIONS[reason].supporting;
  return sup && sup.length ? joinAnd(sup.map((s) => citeInProse(s))) : "";
}

/** Escalation citations (round 3+ liability), or "". */
export function citeReasonEscalation(reason: DisputeReasonCode): string {
  const esc = REASON_CITATIONS[reason].escalation;
  return esc && esc.length ? joinAnd(esc.map((s) => citeInProse(s))) : "";
}
