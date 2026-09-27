# Credit Docket

**FCRA dispute letter engine and workbench.** Ingests consumer credit reports, normalizes them into a canonical shape, generates legally-cited dispute letters for the three major bureaus, and persists encrypted consumer profiles for round-based dispute tracking.

Companion product to [Docket Strategist](https://github.com/Porcse51115-ux/docket-strategist) — a multi-agent legal reasoning system that decides *what to dispute*, while Credit Docket produces *the letter that executes the dispute*. The two share byte-identical content-hash identifiers (verified across a live HTTP round-trip) and compose without any translation layer between them.

---

## See it in 30 seconds

No setup required — a sandbox provider generates a realistic mock credit report and pipes it through the full pipeline:

```bash
git clone https://github.com/Porcse51115-ux/credit-docket.git
cd credit-docket
npm install
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" > .env-key.txt
echo "FIELD_MASTER_KEY=$(cat .env-key.txt)" > .env
npm run demo
```

Output: three FCRA dispute letters (one per bureau) with real statutory citations, correct DOFD-based obsolescence clocks, and proper certified-mail formatting — all generated in the console.

---

## What's inside

```
credit-docket/
├── src/
│   ├── api.ts                Express API with request logging and health check
│   ├── service.ts            Main dispute pipeline orchestrator
│   ├── normalize.ts          Canonical tradeline/inquiry ID hashing
│   ├── crypto.ts             AES-256-GCM envelope encryption
│   ├── storage.ts            ProfileStore interface + InMemory impl
│   ├── postgresStore.ts      Postgres-backed ProfileStore with health check
│   ├── shared/law/           FCRA/FDCPA citation registry (data, not code)
│   ├── letters/
│   │   ├── engine.ts         LetterRequest -> generated letter templates
│   │   └── templates.ts      11 dispute reason templates with citation injection
│   └── providers/
│       └── SandboxProvider.ts Realistic mock report generator for demos
├── web/                      Vite + React FCRA dispute workbench
│   └── src/
│       ├── CreditDocket.jsx     Main app with 8-tab workbench UI
│       ├── MonitoringPanel.jsx  Pull + review + generate letters
│       ├── ReportUpload.jsx     Browser-side PDF/HTML/text parser
│       ├── reportParser.js      PII-safe client-side parsing
│       └── creditApi.js         API client
├── test/                     35 tests (backend, no frontend e2e yet)
├── migrations/
│   └── 001_init.sql          Postgres schema + grants
└── example.ts                Standalone demo (npm run demo)
```

**Backend stack:** TypeScript · Node 20+ · Express · pg (Postgres) · AES-256-GCM crypto (Node stdlib)

**Frontend stack:** React 18 · Vite · PDF.js · lucide-react · localStorage for state

**Tests:** tsx built-in test runner · pg-mem for Postgres tests (no live DB needed)

---

## Architecture

### The letter pipeline

```
Consumer credit report (from API pull or browser upload)
    ↓
normalize.ts computes stable content-hash IDs
    (tl_ = tradeline, iq_ = inquiry, pr_ = public record)
    ↓
crypto.ts encrypts account numbers per-record with envelope encryption
    (per-record data key, wrapped by FIELD_MASTER_KEY)
    ↓
storage.ts persists to Postgres OR falls back to in-memory
    ↓
Consumer selects items to dispute, picks a reason per item
    ↓
letters/engine.ts renders letter templates with:
    - Sender identity block (from Profile tab)
    - Bureau mailing address (hardcoded, verified against current CFPB records)
    - Correct FCRA/FDCPA citation from shared/law/
    - Round-appropriate escalation language (Round 1 vs 3+)
    ↓
Three letters returned (one per bureau where item is present)
```

### Cross-language content-hash IDs

Every tradeline, inquiry, and public record receives a deterministic identifier computed from a canonical subset of its fields:

```typescript
// TypeScript (normalize.ts)
tradelineId(a)   = "tl_" + sha256(clean(a.creditorName) + ":" + last4(a.accountNumberMasked))[0:16]
inquiryId(q, b)  = "iq_" + sha256(clean(q.subscriberName) + ":" + q.date + ":" + b)[0:16]
publicRecId(p,b) = "pr_" + sha256(p.kind + ":" + p.filed + ":" + p.reference + ":" + b)[0:16]
```

The Python side ([Docket Strategist](https://github.com/Porcse51115-ux/docket-strategist)) implements the identical algorithm and both codebases produce **byte-identical** hashes for the same inputs.

Verified in three places:
1. Direct byte comparison of hash function outputs (unit tests both sides)
2. Regression-locked known-input hashes in both test suites
3. Live HTTP round-trip: Docket Strategist fetched a persisted profile from Credit Docket, ran classifier + strategy, POSTed the resulting `itemId` back to `/api/letters`, and Credit Docket resolved the byte-identical ID and returned 3 letters (`skipped: 0`)

Same tradeline, two languages, one identifier. Zero translation layer.

### Envelope encryption

Account numbers never appear in plaintext outside the encryption boundary:

- `FIELD_MASTER_KEY` (32 bytes, base64) — set in `.env`, never in code or logs
- Each stored `CreditProfile` gets its own `wrappedDataKey` (a random 32-byte data key encrypted with the master key)
- Individual account numbers within the profile are encrypted with the record's data key under AES-256-GCM
- Only `accountNumberMasked` (`****4471`) is exposed in API responses or letter output
- Even a full database dump reveals nothing without the master key

Tested via `test/crypto.test.ts` — encryption round-trips and detects tampering.

### PII-safe browser parsing

The frontend's file upload path processes PDF/HTML/text/JSON credit reports **entirely in the browser**. Raw report text — which contains SSNs, DOBs, full account numbers, and other highly sensitive data — never leaves the user's device. Only the structured, masked-account-number result gets stored server-side.

Handled by `web/src/reportParser.js`.

---

## Full quickstart (API + Postgres + Frontend)

### 1. Create a Postgres database

Any Postgres 14+ works. Simplest option is a free Supabase project:

- Go to [supabase.com](https://supabase.com), create a project
- Copy the Session (direct) connection string from Project Settings → Database → Connection String
- Apply the migration via Supabase SQL Editor:

```sql
-- Paste contents of migrations/001_init.sql
```

The migration creates the `credit_profiles` table and its grants.

### 2. Configure the API

```bash
git clone https://github.com/Porcse51115-ux/credit-docket.git
cd credit-docket
npm install
```

Create `.env` (never commit this file):

```bash
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
FIELD_MASTER_KEY=<paste the 44-char base64 key here>
PORT=8787
WEB_ORIGIN=http://localhost:5173
DATABASE_URL=<paste your Postgres session URL here>
PGSSL=require
```

Verify env loads and DB connects:

```bash
npm test          # 35 tests should pass (uses pg-mem, doesn't touch your Postgres)
npm run api       # Should log: monitoring API on :8787 (provider: sandbox, store: postgres)
```

### 3. Configure and run the frontend

```bash
cd web
npm install
npm run dev       # Vite serves on http://localhost:5173
```

Open the URL. The 8-tab dispute workbench should load:
- **Dashboard** — case counters
- **Profile** — consumer identity for letter header (name, address, SSN last 4, DOB)
- **Monitoring** — pull a credit profile, review items, generate letters
- **Items** — manual item tracking
- **Letters** — letter drafting workspace
- **Goodwill / PFD** — goodwill and pay-for-delete letters
- **Tracking** — dispute-round tracker
- **Fast track** — accelerated workflows

Try it:
1. Profile tab → fill in a name, address, city/state/zip (rest is optional)
2. Monitoring tab → enter any consumer ID and consent token → "Pull from all bureaus"
3. Check items to dispute → "Generate letters"

---

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `FIELD_MASTER_KEY` | Yes | — | AES-256-GCM master key (fatal if missing) |
| `PORT` | No | 8787 | API listen port |
| `WEB_ORIGIN` | No | `*` | CORS origin for frontend |
| `DATABASE_URL` | No | (in-memory fallback) | Postgres connection string |
| `PGSSL` | No | (off) | Set to `require` for TLS Postgres |

Missing `DATABASE_URL` triggers a startup warning and in-memory fallback — data is lost on restart. Only intentional in test environments.

---

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness + DB reachability probe (`{ok, provider, store, dbOk}`, returns 503 if DB down) |
| `POST` | `/api/pull` | Trigger a tri-bureau pull for a consumer, persist encrypted profile |
| `GET` | `/api/profile/:consumerId` | Fetch a stored profile (account numbers masked) |
| `POST` | `/api/letters` | Generate letters for selected items — see `LetterRequest` shape in `src/letters/engine.ts` |

Every request logs its method, path, status, and duration.

---

## Security posture

- **Production dependencies:** `npm audit --production` = **0 vulnerabilities** on both API and frontend as of 2026-09-27
- **Dev dependencies:** Vite/vitest ecosystem has known CVEs but does not ship in the runtime bundle
- **Account numbers:** never leave the encryption boundary — masked in API responses, masked in letter output, ciphertext-only in database rows
- **Master key:** required at startup, validated for correct byte length, never logged
- **PII in browser upload path:** processed client-side only, never uploaded to any server
- **TLS to Postgres:** required in production via `PGSSL=require`

Not yet production-hardened:
- No rate limiting (add in front via reverse proxy)
- No auth on API endpoints (assumes upstream session/JWT)
- No PII scrubbing in log lines (request paths only, no bodies)

---

## Test suite

```bash
npm test    # 35 tests, ~2 seconds
```

Covers:

- **Law citation registry (11 tests)** — every citation has a valid URL and act, every reason plan maps to real citations, no drift between source and generated JSON
- **Encryption (2 tests)** — envelope crypto round-trips, tampering detected
- **Normalization / merging (3 tests)** — same furnisher merges across bureaus, different furnisher with same account number flagged as possible duplicate, §605 obsolescence detected from DOFD
- **Stable IDs (7 tests)** — regression-locked known-input hashes, cross-bureau merge semantics, tradelineId is a pure function
- **Letter templates (5 tests)** — grounded letter renders, `furnisher_direct` addresses furnisher not bureau, `debt_validation` uses FDCPA §809, round 3 appends escalation
- **Service (2 tests)** — transient failure retry, partial profile handling
- **Postgres store (4 tests via pg-mem)** — put/get round-trip, upsert on conflict, unknown consumer returns null, list all

---

## Relationship to Docket Strategist

Credit Docket produces letters. Docket Strategist produces the strategy behind them.

- **Credit Docket** — deterministic FCRA letter engine. Given a `LetterRequest` (`itemId`, `reason`, `round`, `sender`), returns three legally-cited dispute letters. Rules-based, no LLM in the pipeline.

- **Docket Strategist** — multi-agent legal reasoning system. Ingests a credit report, classifies each item against a 19-tag vocabulary using a tiered LLM router (fast local Llama for clear cases, Claude Opus for tricky), retrieves relevant FCRA/FDCPA law from a purpose-built vector store, drafts a dispute strategy with self-critique, and hands the resulting `Strategy` object to a Drafter Agent that POSTs to Credit Docket's `/api/letters` endpoint.

The two share:
- Byte-identical content-hash identifiers (`tl_*`, `iq_*`, `pr_*`)
- The FCRA/FDCPA statute enum (`FCRA_605`, `FDCPA_809`, etc.)
- The `DisputeReasonCode` enum (`outdated`, `not_mine`, etc.)
- The `BureauKey` enum (`equifax`, `experian`, `transunion`)

...but neither depends on the other at runtime. Credit Docket stands alone as a letter engine. Docket Strategist stands alone as a strategy system. Together they cover the full FCRA dispute workflow, with a defended contract between them documented in Docket Strategist's `docs/integration-audit.md`.

---

## License

Proprietary. Portfolio project — see [github.com/Porcse51115-ux](https://github.com/Porcse51115-ux) for author.
