// Run with: FIELD_MASTER_KEY=... npx tsx --test test/module.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

import { FieldCrypto, LocalMasterKey, maskAccount } from "../src/crypto";
import { normalize, BureauPullRecord, RawPayload } from "../src/normalize";
import { generateLetters, Sender } from "../src/letters/engine";
import { MonitoringService } from "../src/service";
import { InMemoryProfileStore } from "../src/storage";
import { SandboxProvider } from "../src/providers/SandboxProvider";
import { CreditDataProvider, BureauPullOutcome } from "../src/providers/CreditDataProvider";
import { ALL_BUREAUS, BureauKey, PullRequest } from "../src/types";

process.env.FIELD_MASTER_KEY ??= randomBytes(32).toString("base64");
const crypto = () => new FieldCrypto(new LocalMasterKey());

const sender: Sender = {
  name: "Test User", address: "1 Main St", cityStateZip: "Allentown, PA 18101",
  ssnLast4: "1234", dob: "01/01/1990",
};

function payload(bureau: BureauKey, extra: RawPayload["accounts"] = []): RawPayload {
  return {
    bureau,
    accounts: [
      { creditor: "Midland Funding LLC", account_number: "517234410098", type: "Collection",
        first_delinquency: "2020-11-15", balance: 842, status: "Collection", payment_status: "Collection" },
      { creditor: "Capital One", account_number: "414720008833", type: "Credit Card",
        first_delinquency: "2017-08-01", balance: 0, status: "Charge-off", payment_status: "Charge-off" },
      ...extra,
    ],
    inquiries: [{ subscriber: "CarMax Auto Finance", date: "2026-01-12", kind: "hard" }],
    public_records: [],
  };
}

function record(bureau: BureauKey, p?: RawPayload): BureauPullRecord {
  return { ok: true, bureau, payload: p ?? payload(bureau), attempts: 1 };
}

test("encryption round-trips and detects tampering", async () => {
  const c = crypto();
  const { wrapped, key } = await c.newRecordKey();
  const sealed = c.encryptField(key, "517234410098");
  assert.equal(c.decryptField(key, sealed), "517234410098");
  assert.equal(await c.decryptWithWrappedKey(wrapped, sealed), "517234410098");
  // Flip a byte in the ciphertext -> auth tag check must throw.
  const parts = sealed.split(".");
  const ct = Buffer.from(parts[2], "base64"); ct[0] ^= 0xff;
  parts[2] = ct.toString("base64");
  assert.throws(() => c.decryptField(key, parts.join(".")));
});

test("masking keeps only last 4", () => {
  assert.equal(maskAccount("517234410098"), "****0098");
  assert.equal(maskAccount("12"), "****");
});

test("same furnisher merges across bureaus; full account number never leaves", async () => {
  const raws = ALL_BUREAUS.map((b) => record(b));
  const { profile, wrappedDataKey } = await normalize("c1", raws, crypto());
  assert.ok(wrappedDataKey.length > 0);
  const midland = profile.tradelines.find((t) => t.creditorName.includes("Midland"))!;
  assert.equal(midland.presence.length, 3, "merged into one row with 3 bureau presences");
  assert.equal(midland.accountNumberMasked, "****0098");
  // The model carries an encrypted number, never the plaintext.
  assert.ok(midland.accountNumberEnc && !midland.accountNumberEnc.includes("517234410098"));
});

test("different furnisher, same number -> flagged as possible duplicate", async () => {
  const dup: RawPayload["accounts"] = [{
    creditor: "Midland Credit Management", account_number: "517234410098", type: "Collection",
    first_delinquency: "2020-11-15", balance: 842, status: "Collection", payment_status: "Collection",
  }];
  const raws = [record("experian", payload("experian", dup)), record("equifax")];
  const { profile } = await normalize("c2", raws, crypto());
  const flagged = profile.tradelines.filter((t) => t.possibleDuplicateOf);
  assert.equal(flagged.length, 2, "both sides cross-linked");
});

test("§605 obsolescence detected from old delinquency date", async () => {
  const { profile } = await normalize("c3", [record("equifax")], crypto());
  const capone = profile.tradelines.find((t) => t.creditorName === "Capital One")!;
  assert.ok(capone.signals.includes("past_reporting_window"));
});

test("basis guard: factual claim without assertion is skipped", async () => {
  const { profile } = await normalize("c4", [record("equifax")], crypto());
  const item = profile.tradelines[0];
  const res = generateLetters(profile, sender, [{ itemId: item.id, reason: "not_mine" }]);
  assert.equal(res.letters.length, 0);
  assert.equal(res.skipped.length, 1);
  assert.match(res.skipped[0].reason, /frivolous risk/i);
});

test("grounded letter renders with citation, balance, and assertion", async () => {
  const { profile } = await normalize("c5", [record("equifax")], crypto());
  const item = profile.tradelines.find((t) => t.creditorName.includes("Midland"))!;
  const res = generateLetters(profile, sender, [
    { itemId: item.id, reason: "incorrect_balance", assertion: "Paid in full 03/2023; receipt attached." },
  ]);
  assert.equal(res.letters.length, 1);
  const txt = res.letters[0].text;
  assert.match(txt, /15 U\.S\.C\. §1681i/);
  assert.match(txt, /\$842\.00/);
  assert.match(txt, /receipt attached/);
  assert.match(txt, /Equifax Information Services LLC/);
});

test("outdated dispute requires a first-delinquency date", async () => {
  const noDate: RawPayload = {
    bureau: "equifax",
    accounts: [{ creditor: "Acme", account_number: "999900001111", type: "Collection", status: "Collection" }],
    inquiries: [], public_records: [],
  };
  const { profile } = await normalize("c6", [record("equifax", noDate)], crypto());
  const res = generateLetters(profile, sender, [{ itemId: profile.tradelines[0].id, reason: "outdated" }]);
  assert.equal(res.letters.length, 0);
  assert.match(res.skipped[0].reason, /first-delinquency/i);
});

// A provider that fails a fixed number of times before succeeding.
class FlakyProvider implements CreditDataProvider {
  readonly name = "flaky";
  private hits = new Map<BureauKey, number>();
  constructor(private failsBeforeSuccess: number) {}
  async pullBureau(_req: PullRequest, bureau: BureauKey): Promise<BureauPullOutcome> {
    const n = (this.hits.get(bureau) ?? 0) + 1;
    this.hits.set(bureau, n);
    if (n <= this.failsBeforeSuccess) return { bureau, ok: false, error: "transient" };
    return { bureau, ok: true, report: { bureau, payload: payload(bureau) } };
  }
}

test("service retries transient failures and recovers", async () => {
  const svc = new MonitoringService(new FlakyProvider(2), crypto(), new InMemoryProfileStore(),
    { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 });
  const req: PullRequest = { consumerId: "c7", bureaus: ALL_BUREAUS, consentToken: "t", permissiblePurpose: "test" };
  const profile = await svc.pullAndStore(req);
  assert.equal(profile.partial, false);
  assert.equal(profile.bureausReturned.length, 3);
});

test("service returns a partial profile when one bureau stays down", async () => {
  const svc = new MonitoringService(new SandboxProvider(["transunion"]), crypto(), new InMemoryProfileStore(),
    { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 2 });
  const req: PullRequest = { consumerId: "c8", bureaus: ALL_BUREAUS, consentToken: "t", permissiblePurpose: "test" };
  const profile = await svc.pullAndStore(req);
  assert.equal(profile.partial, true);
  assert.deepEqual(profile.bureausReturned.sort(), ["equifax", "experian"]);
  const tu = profile.diagnostics.find((d) => d.bureau === "transunion")!;
  assert.equal(tu.ok, false);
  assert.equal(tu.attempts, 2);
});
