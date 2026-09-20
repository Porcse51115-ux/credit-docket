// letters/templates.ts — per-reason templates with {{field}} injection.
//
// Each template is plain text with {{tokens}}. The engine fills tokens from the
// account/inquiry data plus the user's asserted basis. Citations are real:
//   FCRA §611 (15 U.S.C. §1681i)  — reinvestigation, delete-if-unverifiable
//   FCRA §605 (15 U.S.C. §1681c)  — obsolescence (7yr / 10yr bankruptcy)
//   FCRA §623 (15 U.S.C. §1681s-2)— furnisher duties
//
// `requiresAssertion: true` means the letter makes a factual claim the consumer
// must stand behind. The engine refuses to render it without an asserted basis,
// and flags frivolous risk — the same discipline as the Credit Docket UI.

import { DisputeReasonCode } from "../types";

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
Please complete your reinvestigation within the period FCRA §611 allows and send me
a corrected copy of my file with written results.

Sincerely,


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

Under FCRA §611 (15 U.S.C. §1681i), please conduct a reasonable reinvestigation. If the
furnisher cannot verify that this account belongs to me and is accurate and complete, it
must be deleted under §611(a)(5)(A)(i).
` + COMMON_FOOTER,
  },

  incorrect_balance: {
    reason: "incorrect_balance", label: "Incorrect balance", requiresAssertion: true,
    subject: "Dispute — inaccurate balance — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) shows a balance
of {{reportedBalance}}, which is inaccurate. {{assertion}}

Reporting an inaccurate balance violates the accuracy requirement of FCRA §611
(15 U.S.C. §1681i). Please verify the correct balance with the furnisher and correct or
delete the entry if it cannot be substantiated.
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
it if the current reporting cannot be verified, per FCRA §611 (15 U.S.C. §1681i).
` + COMMON_FOOTER,
  },

  never_late: {
    reason: "never_late", label: "Never late / incorrect late marks", requiresAssertion: true,
    subject: "Dispute — inaccurate late-payment history — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) reflects late
payment(s) that are inaccurate. {{assertion}}

Please reinvestigate the payment history under FCRA §611 (15 U.S.C. §1681i) and remove any
late-payment notations the furnisher cannot verify as accurate and complete.
` + COMMON_FOOTER,
  },

  duplicate: {
    reason: "duplicate", label: "Duplicate tradeline", requiresAssertion: true,
    subject: "Dispute — duplicate reporting of the same debt — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The debt associated with {{creditor}} (account ending {{acctMasked}}) appears to be reported
more than once on my file, inflating my obligations. {{assertion}}

Duplicate reporting of a single debt is inaccurate and incomplete under FCRA §611
(15 U.S.C. §1681i). Please reinvestigate and remove the duplicate tradeline.
` + COMMON_FOOTER,
  },

  incorrect_status: {
    reason: "incorrect_status", label: "Incorrect account status", requiresAssertion: true,
    subject: "Dispute — inaccurate account status — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) is reported with
the status "{{accountStatus}}", which is inaccurate. {{assertion}}

Please reinvestigate under FCRA §611 (15 U.S.C. §1681i) and correct the status, or delete the
entry if the reported status cannot be verified.
` + COMMON_FOOTER,
  },

  outdated: {
    reason: "outdated", label: "Obsolete (§605)", requiresAssertion: false,
    subject: "Dispute — obsolete item beyond reporting period — acct {{acctMasked}}",
    body: COMMON_HEADER +
`
The {{accountType}} reported by {{creditor}} (account ending {{acctMasked}}) is obsolete.
Under FCRA §605 (15 U.S.C. §1681c), most adverse items may not be reported after seven years
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

If any field cannot be verified, it must be corrected or deleted under FCRA §611
(15 U.S.C. §1681i). If your agency returns this as "verified," please also provide the method
of verification under §611(a)(7), including the furnisher's name, address, and phone number.
` + COMMON_FOOTER,
  },

  unauthorized_inquiry: {
    reason: "unauthorized_inquiry", label: "Unauthorized hard inquiry", requiresAssertion: true,
    subject: "Dispute — unauthorized hard inquiry — {{subscriber}}",
    body: COMMON_HEADER +
`
A hard inquiry from {{subscriber}}, dated {{inquiryDate}}, appears on my file. I did not
authorize this inquiry and there was no permissible purpose for it. {{assertion}}

An inquiry made without a permissible purpose violates FCRA §604 (15 U.S.C. §1681b). Please
investigate and remove this inquiry from my credit file.
` + COMMON_FOOTER,
  },
};
