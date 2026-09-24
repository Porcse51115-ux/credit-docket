// Invariants that keep the citation registry honest.
// `pretest` runs build:law first, so generated/law.json is fresh here.
// Run: npx tsx --test test/law.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { CITATIONS, SECTION_IDS } from "../src/shared/law/citations";
import { REASON_CITATIONS } from "../src/shared/law/reason-map";
import {
  citeInProse, citeShort, citeReasonPrimary,
} from "../src/shared/law/citation-prose";
import { TEMPLATES } from "../src/letters/templates";
import bundle from "../src/shared/law/generated/law.json";

const REASONS = Object.keys(REASON_CITATIONS) as (keyof typeof REASON_CITATIONS)[];

test("citeInProse renders section + subsection + correct Act", () => {
  assert.equal(citeInProse("FCRA_611", "a_1_A"), "§611(a)(1)(A) of the FCRA (15 U.S.C. §1681i)");
  assert.equal(citeInProse("FCRA_605"), "§605 of the FCRA (15 U.S.C. §1681c)");
  // The fix: FDCPA sections must NOT say "of the FCRA".
  assert.equal(citeInProse("FDCPA_809"), "§809 of the FDCPA (15 U.S.C. §1692g)");
  assert.equal(citeInProse("FDCPA_807"), "§807 of the FDCPA (15 U.S.C. §1692e)");
});

test("citeShort renders the short form", () => {
  assert.equal(citeShort("FCRA_611", "a_1_A"), "§611(a)(1)(A)");
  assert.equal(citeShort("FCRA_605"), "§605");
});

test("every reason plan references citations that exist", () => {
  for (const reason of REASONS) {
    const plan = REASON_CITATIONS[reason];
    for (const sec of [plan.primary, ...(plan.supporting ?? []), ...(plan.escalation ?? [])]) {
      assert.ok(CITATIONS[sec], `${reason}: unknown section ${sec}`);
    }
  }
});

test("every referenced subsection exists on its parent citation", () => {
  for (const reason of REASONS) {
    const plan = REASON_CITATIONS[reason];
    const subs = CITATIONS[plan.primary].subsections;
    for (const s of plan.primary_subsections ?? []) {
      assert.ok(subs && subs[s], `${reason}: subsection ${s} missing on ${plan.primary}`);
    }
  }
});

test("every subsection has a non-empty prose_ref", () => {
  for (const id of SECTION_IDS) {
    const subs = CITATIONS[id].subsections ?? {};
    for (const [key, sub] of Object.entries(subs)) {
      assert.ok(sub.prose_ref.length > 20, `${id}.${key}: prose_ref too short`);
    }
  }
});

test("every citation has an https source_url and a valid act", () => {
  for (const id of SECTION_IDS) {
    const c = CITATIONS[id];
    assert.match(c.source_url, /^https:\/\/www\.law\.cornell\.edu/, `${id}: bad url`);
    assert.ok(c.act === "FCRA" || c.act === "FDCPA", `${id}: bad act`);
  }
});

test("generated law.json matches the TS source (no drift)", () => {
  assert.deepEqual(bundle.citations, CITATIONS);
  assert.deepEqual(bundle.reason_citations, REASON_CITATIONS);
});

test("bundle version is semver", () => {
  assert.match(bundle.version, /^\d+\.\d+\.\d+$/);
});

test("all dispute reasons have both a plan and a template", () => {
  assert.deepEqual(Object.keys(TEMPLATES).sort(), REASONS.slice().sort());
  assert.equal(REASONS.length, 11);
});

test("each template cites at least its plan's primary statute (USC in body)", () => {
  for (const reason of REASONS) {
    const usc = CITATIONS[REASON_CITATIONS[reason].primary].usc;
    assert.ok(TEMPLATES[reason].body.includes(usc), `${reason}: missing ${usc}`);
  }
});

test("citeReasonPrimary expands subsections with an 'and'", () => {
  const s = citeReasonPrimary("not_mine");
  assert.match(s, /§611\(a\)\(1\)\(A\)/);
  assert.match(s, /§611\(a\)\(5\)\(A\)\(i\)/);
  assert.match(s, / and /);
});
