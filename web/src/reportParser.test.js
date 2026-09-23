// Parser tests. Run: cd web && npm test
// Vitest resolves the pdf.js `?url` import the same way Vite does, so importing
// the module works without a browser. We test the pure paths: heuristic scan,
// JSON import, and the delinquency-label false-positive fix.
import { describe, it, expect } from "vitest";
import { scanText, parseText } from "./reportParser.js";

const SAMPLE = `
MIDLAND FUNDING LLC
Account Number: 5172****0098
Balance: $842.00
Status: Collection
Date of First Delinquency: 11/2020

CAPITAL ONE
Account #: 4147****8833
High Balance: $1,500.00
Status: Charge-off

GOOD BANK CARD
Account: 9900****1234
Balance: $250.00
Status: Current, paid as agreed
`;

describe("scanText (heuristic)", () => {
  const items = scanText(SAMPLE);

  it("detects the collection and the charge-off", () => {
    const types = items.map((i) => i.type).sort();
    expect(types).toContain("Collection");
    expect(types).toContain("Charge-off");
  });

  it("ignores accounts in good standing", () => {
    expect(items.some((i) => /good bank/i.test(i.creditor))).toBe(false);
  });

  it("does not treat a 'Date of First Delinquency' label as a late payment", () => {
    // Midland should surface once (Collection), not also as a bogus Late payment.
    const midland = items.filter((i) => /midland/i.test(i.creditor));
    expect(midland).toHaveLength(1);
    expect(midland[0].type).toBe("Collection");
  });

  it("captures balance and account number where present", () => {
    const midland = items.find((i) => /midland/i.test(i.creditor));
    expect(midland.balance).toBe(842);
    expect(midland.accountNumber).toMatch(/0098/);
  });

  it("flags every candidate for review", () => {
    expect(items.every((i) => i.needsReview === true)).toBe(true);
  });
});

describe("parseText (JSON path)", () => {
  it("maps an array of item-like objects", () => {
    const json = JSON.stringify([
      { creditor: "Acme Collections", type: "Collection", balance: 300, bureaus: { equifax: true } },
    ]);
    const { items } = parseText(json, "x.json");
    expect(items).toHaveLength(1);
    expect(items[0].creditor).toBe("Acme Collections");
    expect(items[0].needsReview).toBe(true);
  });

  it("maps an API CreditProfile via mapProfileToItems", () => {
    const profile = {
      tradelines: [{
        id: "t1", creditorName: "Midland Funding", accountNumberMasked: "****0098",
        accountType: "Collection", signals: ["collection"],
        presence: [{ bureau: "equifax", reportedBalance: 842 }],
      }],
      inquiries: [], publicRecords: [],
    };
    const { items } = parseText(JSON.stringify({ tradelines: profile.tradelines, inquiries: [], publicRecords: [] }), "p.json");
    expect(items).toHaveLength(1);
    expect(items[0].creditor).toBe("Midland Funding");
    expect(items[0].type).toBe("Collection");
  });

  it("returns a warning when nothing is detected", () => {
    const { items, warnings } = parseText("just some unrelated prose with no accounts", "notes.txt");
    expect(items).toHaveLength(0);
    expect(warnings.join(" ")).toMatch(/no negative items/i);
  });
});
