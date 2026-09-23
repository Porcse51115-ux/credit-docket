// Postgres store, verified against an in-memory Postgres (pg-mem) so CI needs
// no real database. Run: npx tsx --test test/postgresStore.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { newDb } from "pg-mem";

import { PostgresProfileStore } from "../src/postgresStore";
import { StoredProfile } from "../src/storage";
import { CreditProfile } from "../src/types";

function profile(consumerId: string, tag: string): CreditProfile {
  return {
    consumerId,
    pulledAt: new Date().toISOString(),
    bureausRequested: ["equifax"],
    bureausReturned: ["equifax"],
    partial: false,
    tradelines: [{
      id: "t1", creditorName: `Midland ${tag}`, accountNumberMasked: "****0098",
      accountNumberEnc: "enc.enc.enc", accountType: "Collection",
      classification: "negative", signals: ["collection"],
      presence: [{ bureau: "equifax", reportedBalance: 842 }],
    }],
    inquiries: [], publicRecords: [], diagnostics: [{ bureau: "equifax", ok: true, attempts: 1 }],
  };
}

async function freshStore() {
  const db = newDb();
  const { Pool } = db.adapters.createPg();
  const store = new PostgresProfileStore(new Pool());
  await store.ensureSchema();
  return store;
}

test("put then get round-trips the profile and wrapped key", async () => {
  const store = await freshStore();
  const rec: StoredProfile = { profile: profile("c1", "A"), wrappedDataKey: "wrapped-key-1" };
  await store.put(rec);
  const got = await store.get("c1");
  assert.ok(got);
  assert.equal(got!.wrappedDataKey, "wrapped-key-1");
  assert.equal(got!.profile.consumerId, "c1");
  assert.equal(got!.profile.tradelines[0].creditorName, "Midland A");
  // Encrypted account number survives storage; plaintext never appears.
  assert.equal(got!.profile.tradelines[0].accountNumberEnc, "enc.enc.enc");
});

test("put upserts on conflict (same consumer overwrites)", async () => {
  const store = await freshStore();
  await store.put({ profile: profile("c1", "A"), wrappedDataKey: "k1" });
  await store.put({ profile: profile("c1", "B"), wrappedDataKey: "k2" });
  const got = await store.get("c1");
  assert.equal(got!.wrappedDataKey, "k2");
  assert.equal(got!.profile.tradelines[0].creditorName, "Midland B");
  const ids = await store.list();
  assert.equal(ids.length, 1, "upsert, not duplicate insert");
});

test("get returns null for unknown consumer", async () => {
  const store = await freshStore();
  assert.equal(await store.get("nope"), null);
});

test("list returns all stored consumer ids", async () => {
  const store = await freshStore();
  await store.put({ profile: profile("c1", "A"), wrappedDataKey: "k" });
  await store.put({ profile: profile("c2", "A"), wrappedDataKey: "k" });
  const ids = (await store.list()).sort();
  assert.deepEqual(ids, ["c1", "c2"]);
});
