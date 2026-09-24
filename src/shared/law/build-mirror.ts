// src/shared/law/build-mirror.ts
// Generates ./generated/law.json from the TS source so the JS frontend can
// import it. Run via `npm run build:law` (hooked into pretest). Bump
// BUNDLE_VERSION whenever a citation changes — Docket Strategist checks it.
// Output is deterministic (no timestamp), so CI can `git diff` it to catch a
// committed mirror that drifted from the TS source.

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { CITATIONS } from "./citations";
import { REASON_CITATIONS } from "./reason-map";

const BUNDLE_VERSION = "1.1.0";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "generated");
fs.mkdirSync(outDir, { recursive: true });

const bundle = {
  version: BUNDLE_VERSION,
  citations: CITATIONS,
  reason_citations: REASON_CITATIONS,
};

const outPath = path.join(outDir, "law.json");
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");

console.log(
  `[build-mirror] Wrote ${Object.keys(CITATIONS).length} citations, ` +
    `${Object.keys(REASON_CITATIONS).length} reason plans -> law.json (v${BUNDLE_VERSION})`
);
