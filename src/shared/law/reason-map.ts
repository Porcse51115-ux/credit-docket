// src/shared/law/reason-map.ts
// The binding: dispute reason -> which statute(s)/subsection(s) to cite.
//
// Keyed by the real DisputeReasonCode union in ../../types (11 reasons).
// `furnisher_direct` (§623) and `debt_validation` (FDCPA §809/§807) are
// furnisher/collector-addressed letters, not bureau-addressed — the engine
// routes them accordingly.

import { DisputeReasonCode } from "../../types";

export type { DisputeReasonCode };

export type ReasonCitationPlan = {
  primary: import("./citations").StatuteSection;
  primary_subsections?: string[];
  supporting?: import("./citations").StatuteSection[];
  escalation?: import("./citations").StatuteSection[];
};

export const REASON_CITATIONS: Record<DisputeReasonCode, ReasonCitationPlan> = {
  not_mine: {
    primary: "FCRA_611",
    primary_subsections: ["a_1_A", "a_5_A_i"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  incorrect_balance: {
    primary: "FCRA_611",
    primary_subsections: ["a_1_A", "a_5_A_i"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  paid_in_full: {
    primary: "FCRA_611",
    primary_subsections: ["a_1_A", "a_5_A_i"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  never_late: {
    primary: "FCRA_611",
    primary_subsections: ["a_1_A", "a_5_A_i"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  duplicate: {
    primary: "FCRA_611",
    primary_subsections: ["a_1_A", "a_5_A_i"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  incorrect_status: {
    primary: "FCRA_611",
    primary_subsections: ["a_1_A", "a_5_A_i"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  unverifiable: {
    primary: "FCRA_611",
    primary_subsections: ["a_5_A_i", "a_6_B_iii", "a_7"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  outdated: {
    primary: "FCRA_605",
    supporting: ["FCRA_611"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  unauthorized_inquiry: {
    primary: "FCRA_604",
    supporting: ["FCRA_615"],
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  furnisher_direct: {
    primary: "FCRA_623",
    escalation: ["FCRA_1681n", "FCRA_1681o"],
  },
  debt_validation: {
    primary: "FDCPA_809",
    supporting: ["FDCPA_807"],
  },
};
