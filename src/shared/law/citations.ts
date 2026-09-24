// src/shared/law/citations.ts
// AUTHORITATIVE statute registry. Edit here, then `npm run build:law` to
// regenerate ./generated/law.json (the mirror the JS frontend imports).
//
// `act` was added on top of the spec so citeInProse can label FDCPA sections
// correctly ("§809 of the FDCPA", not "of the FCRA").

export type StatuteSection =
  | "FCRA_604"
  | "FCRA_605"
  | "FCRA_605B"
  | "FCRA_609"
  | "FCRA_611"
  | "FCRA_615"
  | "FCRA_616"
  | "FCRA_617"
  | "FCRA_623"
  | "FCRA_1681n"
  | "FCRA_1681o"
  | "FDCPA_807"
  | "FDCPA_809";

export type CitationDomain =
  | "reinvestigation"
  | "obsolescence"
  | "unauthorized_inquiry"
  | "furnisher_duty"
  | "identity_theft"
  | "verification_failure"
  | "damages"
  | "willfulness"
  | "debt_validation";

export type Subsection = {
  label: string;
  summary: string;
  prose_ref: string;
};

export type Citation = {
  id: StatuteSection;
  act: "FCRA" | "FDCPA";
  short: string;
  usc: string;
  full_name: string;
  subsections?: Record<string, Subsection>;
  applies_to: CitationDomain[];
  source_url: string;
};

export const CITATIONS: Record<StatuteSection, Citation> = {
  FCRA_604: {
    id: "FCRA_604",
    act: "FCRA",
    short: "§604",
    usc: "15 U.S.C. §1681b",
    full_name: "Permissible purposes of consumer reports",
    applies_to: ["unauthorized_inquiry"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681b",
  },
  FCRA_605: {
    id: "FCRA_605",
    act: "FCRA",
    short: "§605",
    usc: "15 U.S.C. §1681c",
    full_name: "Requirements relating to information contained in consumer reports",
    applies_to: ["obsolescence"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681c",
  },
  FCRA_605B: {
    id: "FCRA_605B",
    act: "FCRA",
    short: "§605B",
    usc: "15 U.S.C. §1681c-2",
    full_name: "Block of information resulting from identity theft",
    applies_to: ["identity_theft"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681c-2",
  },
  FCRA_609: {
    id: "FCRA_609",
    act: "FCRA",
    short: "§609",
    usc: "15 U.S.C. §1681g",
    full_name: "Disclosures to consumers",
    applies_to: ["verification_failure"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681g",
  },
  FCRA_611: {
    id: "FCRA_611",
    act: "FCRA",
    short: "§611",
    usc: "15 U.S.C. §1681i",
    full_name: "Procedure in case of disputed accuracy",
    subsections: {
      a_1_A: {
        label: "(a)(1)(A)",
        summary: "30-day reinvestigation window",
        prose_ref:
          "conduct a reasonable reinvestigation to determine whether the disputed information is inaccurate ... before the end of the 30-day period beginning on the date on which the agency receives the notice of the dispute from the consumer",
      },
      a_3: {
        label: "(a)(3)",
        summary: "Determination that dispute is frivolous or irrelevant",
        prose_ref:
          "the agency may terminate a reinvestigation of information disputed by a consumer under that paragraph if the agency reasonably determines that the dispute by the consumer is frivolous or irrelevant, including by reason of a failure by a consumer to provide sufficient information to investigate the disputed information",
      },
      a_5_A_i: {
        label: "(a)(5)(A)(i)",
        summary: "Delete if unverifiable",
        prose_ref:
          "promptly delete that item of information from the file of the consumer, or modify that item of information, as appropriate, based on the results of the reinvestigation",
      },
      a_6_B_iii: {
        label: "(a)(6)(B)(iii)",
        summary: "Notice of results — content required in bureau response",
        prose_ref:
          "a notice that, if requested by the consumer, a description of the procedure used to determine the accuracy and completeness of the information shall be provided to the consumer by the agency, including the business name and address of any furnisher of information contacted in connection with such information and the telephone number of such furnisher, if reasonably available",
      },
      a_7: {
        label: "(a)(7)",
        summary: "Method of verification on request",
        prose_ref:
          "a description of the procedure used to determine the accuracy and completeness of the information shall be provided to the consumer by the agency, including the business name and address of any furnisher of information contacted in connection with such information",
      },
    },
    applies_to: ["reinvestigation", "verification_failure"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681i",
  },
  FCRA_615: {
    id: "FCRA_615",
    act: "FCRA",
    short: "§615",
    usc: "15 U.S.C. §1681m",
    full_name: "Requirements on users of consumer reports",
    applies_to: ["unauthorized_inquiry"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681m",
  },
  FCRA_616: {
    id: "FCRA_616",
    act: "FCRA",
    short: "§616",
    usc: "15 U.S.C. §1681n",
    full_name: "Civil liability for willful noncompliance",
    applies_to: ["willfulness", "damages"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681n",
  },
  FCRA_617: {
    id: "FCRA_617",
    act: "FCRA",
    short: "§617",
    usc: "15 U.S.C. §1681o",
    full_name: "Civil liability for negligent noncompliance",
    applies_to: ["damages"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681o",
  },
  FCRA_623: {
    id: "FCRA_623",
    act: "FCRA",
    short: "§623",
    usc: "15 U.S.C. §1681s-2",
    full_name: "Responsibilities of furnishers of information to consumer reporting agencies",
    applies_to: ["furnisher_duty"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681s-2",
  },
  FCRA_1681n: {
    id: "FCRA_1681n",
    act: "FCRA",
    short: "§1681n",
    usc: "15 U.S.C. §1681n",
    full_name: "Civil liability for willful noncompliance (escalation)",
    applies_to: ["willfulness", "damages"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681n",
  },
  FCRA_1681o: {
    id: "FCRA_1681o",
    act: "FCRA",
    short: "§1681o",
    usc: "15 U.S.C. §1681o",
    full_name: "Civil liability for negligent noncompliance (escalation)",
    applies_to: ["damages"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1681o",
  },
  FDCPA_807: {
    id: "FDCPA_807",
    act: "FDCPA",
    short: "§807",
    usc: "15 U.S.C. §1692e",
    full_name: "False or misleading representations",
    applies_to: ["debt_validation"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1692e",
  },
  FDCPA_809: {
    id: "FDCPA_809",
    act: "FDCPA",
    short: "§809",
    usc: "15 U.S.C. §1692g",
    full_name: "Validation of debts",
    applies_to: ["debt_validation"],
    source_url: "https://www.law.cornell.edu/uscode/text/15/1692g",
  },
};

/** All defined section ids. */
export const SECTION_IDS = Object.keys(CITATIONS) as StatuteSection[];
