// letters/templates.ts — per-reason templates with {{field}} injection.
//
// Citations are NO LONGER hard-coded here. Every "§X of the Act (USC)" phrase is
// rendered by citeInProse() from the statute registry (src/law/citations.json),
// so there is one source of truth and the reason→section bindings live in
// src/law/reason-map.json. See law.test.ts for the guards.
//
// `requiresAssertion: true` means the letter makes a factual claim the consumer
// must stand behind. The engine refuses to render it without an asserted basis.

import { DisputeReasonCode } from "../types";
import { citeInProse } from "../shared/law";

export interface LetterTemplate {
  reason: DisputeReasonCode;
  label: string;
  requiresAssertion: boolean;
  subject: string;
  body: string; // uses {{tokens}}
}

const COMMON_HEADER = `{{senderName}}
{{senderAddress}}
{{senderCityStateZip}}
{{idLine}}

{{date}}

Sent via Certified Mail, Return Receipt Requested
Tracking No.: ____________________________

{{bureauName}}
{{bureauAddrLine1}}
{{bureauAddrLine2}}

Re: {{subject}}

To Whom It May Concern:
`;

const COMMON_FOOTER = `
Please complete your reinvestigation within the period ${citeInProse("FCRA_611", "a_1_A")}
allows and send me a corrected copy of my file with written results.

{{escalation}}Sincerely,


{{senderName}}

Enclosures: copy of government-issued photo ID; proof of current address.`;

// For letters addressed to a furnisher / collector rather than a bureau.
const FURNISHER_FOOTER = `
Please send your written response to the address above.

{{escalation}}Sincerely,


{{senderName}}

Enclosures: copy of government-issued photo ID; proof of current address.`;

export const TEMPLATES: Record<DisputeReasonCode, LetterTemplate> = {
  not_mine: {
    reason: "not_mine", label: "Account is not mine", requiresAssertion: true,
    subject: "Dispute — account does not belong to me — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
I am disputing the {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}).
This account is not mine. {{assertion}}

Under ${citeInProse("FCRA_611", "a_1_A")}, please conduct a reasonable reinvestigation. If the
furnisher cannot verify that this account belongs to me and is accurate and complete, it
must be deleted under ${citeInProse("FCRA_611", "a_5_A_i")}.
` + COMMON_FOOTER,
  },

  incorrect_balance: {
    reason: "incorrect_balance", label: "Incorrect balance", requiresAssertion: true,
    subject: "Dispute — inaccurate balance — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) shows a balance
of {{reportedBalance}}, which is inaccurate. {{assertion}}

Reporting an inaccurate balance violates the accuracy requirement of ${citeInProse("FCRA_611")}.
Please verify the correct balance with the furnisher and correct or delete the entry under
${citeInProse("FCRA_611", "a_5_A_i")} if it cannot be substantiated.
` + COMMON_FOOTER,
  },

  paid_in_full: {
    reason: "paid_in_full", label: "Paid / settled in full", requiresAssertion: true,
    subject: "Dispute — account satisfied, reported in error — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) is reported with
an outstanding balance, but it has been satisfied. {{assertion}}

Please update the status and balance to reflect that this account is paid/settled, or delete
it under ${citeInProse("FCRA_611", "a_5_A_i")} if the current reporting cannot be verified.
` + COMMON_FOOTER,
  },

  never_late: {
    reason: "never_late", label: "Never late / incorrect late marks", requiresAssertion: true,
    subject: "Dispute — inaccurate late-payment history — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) reflects late
payment(s) that are inaccurate. {{assertion}}

Please reinvestigate the payment history under ${citeInProse("FCRA_611", "a_1_A")} and remove
any late-payment notations the furnisher cannot verify as accurate and complete.
` + COMMON_FOOTER,
  },

  duplicate: {
    reason: "duplicate", label: "Duplicate tradeline", requiresAssertion: true,
    subject: "Dispute — duplicate reporting of the same debt — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The debt associated with {{creditor}} (account ending {{acctMasked}}) appears to be reported
more than once on my file, inflating my obligations. {{assertion}}

Duplicate reporting of a single debt is inaccurate and incomplete under ${citeInProse("FCRA_611")}.
Please reinvestigate and remove the duplicate tradeline under ${citeInProse("FCRA_611", "a_5_A_i")}.
` + COMMON_FOOTER,
  },

  incorrect_status: {
    reason: "incorrect_status", label: "Incorrect account status", requiresAssertion: true,
    subject: "Dispute — inaccurate account status — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) is reported with
the status "{{accountStatus}}", which is inaccurate. {{assertion}}

Please reinvestigate under ${citeInProse("FCRA_611")} and correct the status, or delete the
entry under ${citeInProse("FCRA_611", "a_5_A_i")} if the reported status cannot be verified.
` + COMMON_FOOTER,
  },

  outdated: {
    reason: "outdated", label: "Obsolete (§605)", requiresAssertion: false,
    subject: "Dispute — obsolete item beyond reporting period — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) is obsolete.
Under ${citeInProse("FCRA_605")}, most adverse items may not be reported after seven years
(ten for bankruptcy). The controlling date for this account is {{dofd}}, which exceeds that
period.

Please delete this entry as it is past the statutory reporting window.
` + COMMON_FOOTER,
  },

  unverifiable: {
    reason: "unverifiable", label: "Request verification (§611)", requiresAssertion: false,
    subject: "Dispute — request for reinvestigation — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
I am requesting a reinvestigation of the {{accountType}} reported by {{creditor}} (account
ending {{acctMasked}}). Please verify, with the furnisher, the accuracy and completeness of
every field — balance, status, dates, and payment history.

If any field cannot be verified, it must be corrected or deleted under ${citeInProse("FCRA_611", "a_5_A_i")}.
If your agency returns this as "verified," please also provide the method of verification
under ${citeInProse("FCRA_611", "a_7")}, including the furnisher's name, address, and phone number.
` + COMMON_FOOTER,
  },

  unauthorized_inquiry: {
    reason: "unauthorized_inquiry", label: "Unauthorized hard inquiry", requiresAssertion: true,
    subject: "Dispute — unauthorized hard inquiry — {{subscriber}}",
    body: COMMON_HEADER +
`
A hard inquiry from {{subscriber}}, dated {{inquiryDate}}, appears on my file. I did not
authorize this inquiry and there was no permissible purpose for it. {{assertion}}

An inquiry made without a permissible purpose violates ${citeInProse("FCRA_604")}. Please
investigate and remove this inquiry from my credit file.
` + COMMON_FOOTER,
  },

  furnisher_direct: {
    reason: "furnisher_direct", label: "Direct dispute to furnisher (§623)", requiresAssertion: true,
    subject: "Direct dispute to furnisher — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
I am submitting a direct dispute regarding the {{accountType}} you report on my file
(account ending {{acctMasked}}). {{assertion}}

As the furnisher, you have duties under ${citeInProse("FCRA_623")}, including the duty to
investigate a direct dispute and to refrain from reporting information you know or have
reasonable cause to believe is inaccurate. Please investigate, correct or delete the entry as
appropriate, and notify each consumer reporting agency to which you have reported this account.
` + FURNISHER_FOOTER,
  },

  debt_validation: {
    reason: "debt_validation", label: "Debt validation (FDCPA §809)", requiresAssertion: false,
    subject: "Debt validation request — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
I dispute this debt and request validation under ${citeInProse("FDCPA_809")}. If you are a debt
collector and this is within 30 days of your first communication with me, please provide
verification of the debt — the amount owed, the name of the original creditor, and evidence
that you are authorized to collect it — before continuing collection. {{assertion}}

Until you provide validation, please cease collection activity and refrain from reporting this
account to the consumer reporting agencies. Misrepresenting the status of an unvalidated debt
may also violate ${citeInProse("FDCPA_807")}.
` + FURNISHER_FOOTER,
  },
};
