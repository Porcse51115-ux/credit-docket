// normalize-id-stability.test.ts
//
// Locks the deterministic-ID scheme. If someone reverts to randomUUID() or
// changes the hash inputs, these tests fail loudly.
//
// Why this matters: Docket Strategist's case store tracks disputes by ID
// across pulls. If the same account gets a different ID on the next pull,
// case tracking breaks silently.
//
// Uses Node's built-in test runner (node:test) — matches the rest of the
// backend test suite. Run with `npm test`.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FieldCrypto, LocalMasterKey } from "../src/crypto";
import {
  BureauPullRecord,
  RawAccount,
  RawInquiry,
  RawPublicRecord,
  inquiryId,
  normalize,
  publicRecordId,
  tradelineId,
} from "../src/normalize";

// Deterministic test key so ID hashes are reproducible in CI.
// (The master key doesn't affect IDs — only the account-number ciphertext —
// but we set one so the test environment matches the demo.)
const TEST_MASTER_KEY = Buffer.alloc(32, 7).toString("base64");

function makeCrypto(): FieldCrypto {
  return new FieldCrypto(new LocalMasterKey(TEST_MASTER_KEY));
}

// A minimal fixture that touches all three ID paths.
function samplePulls(): BureauPullRecord[] {
  const account: RawAccount = {
    creditor: "Capital One",
    account_number: "4471000012344471",
    type: "Credit Card",
    opened: "2018-04-01",
    balance: 842,
    status: "Open",
    payment_status: "Current",
    reported: "2026-09-01",
  };
  const inquiry: RawInquiry = {
    subscriber: "Best Buy",
    date: "2026-08-15",
    kind: "hard",
  };
  const publicRecord: RawPublicRecord = {
    kind: "bankruptcy",
    filed: "2015-03-10",
    reference: "BK-2015-000123",
  };

  return [
    {
      ok: true,
      bureau: "equifax",
      attempts: 1,
      payload: {
        bureau: "equifax",
        accounts: [account],
        inquiries: [inquiry],
        public_records: [publicRecord],
      },
    },
    {
      ok: true,
      bureau: "experian",
      attempts: 1,
      payload: {
        bureau: "experian",
        accounts: [account],
        inquiries: [inquiry],
        public_records: [publicRecord],
      },
    },
    {
      ok: true,
      bureau: "transunion",
      attempts: 1,
      payload: {
        bureau: "transunion",
        accounts: [account],
        inquiries: [inquiry],
        public_records: [publicRecord],
      },
    },
  ];
}

describe("normalize — stable IDs", () => {
  it("tradeline ID is stable across pulls", async () => {
    const p1 = await normalize("consumer_1", samplePulls(), makeCrypto());
    const p2 = await normalize("consumer_1", samplePulls(), makeCrypto());

    const ids1 = p1.profile.tradelines.map((t) => t.id).sort();
    const ids2 = p2.profile.tradelines.map((t) => t.id).sort();

    assert.deepEqual(ids1, ids2);
    assert.ok(ids1.length > 0, "expected at least one tradeline");
  });

  it("inquiry ID is stable across pulls", async () => {
    const p1 = await normalize("consumer_1", samplePulls(), makeCrypto());
    const p2 = await normalize("consumer_1", samplePulls(), makeCrypto());

    const ids1 = p1.profile.inquiries.map((q) => q.id).sort();
    const ids2 = p2.profile.inquiries.map((q) => q.id).sort();

    assert.deepEqual(ids1, ids2);
    assert.ok(ids1.length > 0, "expected at least one inquiry");
  });

  it("public record ID is stable across pulls", async () => {
    const p1 = await normalize("consumer_1", samplePulls(), makeCrypto());
    const p2 = await normalize("consumer_1", samplePulls(), makeCrypto());

    const ids1 = p1.profile.publicRecords.map((p) => p.id).sort();
    const ids2 = p2.profile.publicRecords.map((p) => p.id).sort();

    assert.deepEqual(ids1, ids2);
    assert.ok(ids1.length > 0, "expected at least one public record");
  });

  it("same account across three bureaus merges to one tradeline with one ID", async () => {
    const p = await normalize("consumer_1", samplePulls(), makeCrypto());

    assert.equal(p.profile.tradelines.length, 1);
    assert.equal(p.profile.tradelines[0].presence.length, 3);
    // ID matches the deterministic tradelineId() for the sample account.
    assert.equal(
      p.profile.tradelines[0].id,
      tradelineId({
        creditor: "Capital One",
        account_number: "4471000012344471",
        type: "Credit Card",
      })
    );
  });

  it("tradelineId is a pure function of creditor + last 4", () => {
    // Same account, different formatting → same ID.
    const a = tradelineId({
      creditor: "Capital One",
      account_number: "4471000012344471",
      type: "Credit Card",
    });
    const b = tradelineId({
      creditor: "  CAPITAL   one  ",
      account_number: "4471-0000-1234-4471",
      type: "Credit Card",
    });
    assert.equal(a, b);

    // Different creditor, same last 4 → different ID (as designed —
    // duplicate detection happens elsewhere via possibleDuplicateOf).
    const c = tradelineId({
      creditor: "Discover",
      account_number: "6011000012344471",
      type: "Credit Card",
    });
    assert.notEqual(c, a);
  });

  it("regression lock — known input yields known hash", () => {
    // If someone changes the hash algorithm or input formatting,
    // this test surfaces the drift immediately. Update the expected
    // value here only when the change is intentional.
    assert.equal(
      tradelineId({
        creditor: "Capital One",
        account_number: "4471000012344471",
        type: "Credit Card",
      }),
      "tl_c50d34cada71ae10" // sha256("capitalone:4471") first 16 hex chars
    );

    assert.equal(
      inquiryId({ subscriber: "Best Buy", date: "2026-08-15", kind: "hard" }, "equifax"),
      "iq_9367e470ade684f4" // sha256("bestbuy:2026-08-15:equifax") first 16 hex chars
    );

    assert.equal(
      publicRecordId(
        { kind: "bankruptcy", filed: "2015-03-10", reference: "BK-2015-000123" },
        "equifax"
      ),
      "pr_b3cf8554bc008f51" // sha256("bankruptcy:2015-03-10:BK-2015-000123:equifax") first 16 hex chars
    );
  });

  it("IDs have their type prefix", async () => {
    const p = await normalize("consumer_1", samplePulls(), makeCrypto());
    for (const t of p.profile.tradelines) {
      assert.match(t.id, /^tl_[a-f0-9]{16}$/);
    }
    for (const q of p.profile.inquiries) {
      assert.match(q.id, /^iq_[a-f0-9]{16}$/);
    }
    for (const pr of p.profile.publicRecords) {
      assert.match(pr.id, /^pr_[a-f0-9]{16}$/);
    }
  });
});
