// src/shared/law/index.ts
export { CITATIONS, SECTION_IDS } from "./citations";
export type { Citation, StatuteSection, CitationDomain, Subsection } from "./citations";
export { REASON_CITATIONS } from "./reason-map";
export type { DisputeReasonCode, ReasonCitationPlan } from "./reason-map";
export {
  citeInProse,
  citeShort,
  citeReasonPrimary,
  citeReasonSupporting,
  citeReasonEscalation,
} from "./citation-prose";
