# Credit Docket — Monitoring Module

A provider-agnostic service layer that pulls a consumer's tri-bureau credit
profile, normalizes it, stores it encrypted, and feeds the existing Credit Docket
dispute UI. Letter generation reuses the same grounded-basis discipline as the
front-end app: it will not manufacture a factual claim ("not mine," "paid in
full") without a basis the user asserts.

```
  permissioned provider ──▶ normalize ──▶ encrypt + store ──▶ /profile API ──▶ Credit Docket dashboard
                                                                    │
                                                                    └──▶ /letters API ──▶ grounded dispute letters
```

## Status

- **Backend complete and verified.** Strict type-check, 14/14 tests, demo +
  live API smoke-tested (CORS, pull, letters). Postgres store included/tested.
- **Front end is a runnable Vite app** (`web/`), builds clean, deploys to
  Vercel / GitHub Pages. Monitoring tab + `localStorage` persistence.
- **Two ingestion paths:** browser-side report upload/parse (no backend needed)
  and the automated bureau pull (sandbox data until you credential an aggregator).
- **License:** proprietary (`LICENSE`). Fill in your legal name/entity.

## Read this before you write a line of production code

You cannot legally pull another person's credit data without a **permissible
purpose under the FCRA (15 U.S.C. §1681b)** and bureau credentialing. There is no
open public bureau API. Two consequences for this module:

1. **Do not scrape or automate consumer logins to IdentityIQ / SmartCredit /
   Credit Karma.** That violates their terms and risks CFAA and FCRA liability.
   It is the single most common reason credit-repair shops get sued. If you want
   that data, use the provider's *official partner API*.

2. **Use a permissioned aggregator or a bureau's official B2B2C program.**
   Candidates to evaluate (confirm current terms yourself):
   - **CRS Credit API** — unified, SOC 2 Type II, multi-bureau + identity.
   - **Soft Pull Solutions** — tri-merge or single-bureau, sandbox + Postman.
   - **Equifax Consumer Engagement Suite** — direct B2B2C for showing consumers
     their own reports.

   All require you to demonstrate permissible purpose and pass credentialing.
   Expect FCRA + GLBA Safeguards Rule obligations, and if you ever charge
   consumers for repair work, the **Credit Repair Organizations Act** (no
   advance fees, written contract, 3-day cancellation, no misrepresentations).

This module is built so the data source is a swappable port. Develop against the
included **SandboxProvider** today; swap in `AggregatorProvider` once credentialed.
The aggregator adapter is a real HTTP client skeleton — **not** a scraper.

## Layout

| File | Concern |
|------|---------|
| `src/types.ts` | Normalized data models (the contract everything shares) |
| `src/crypto.ts` | AES-256-GCM envelope encryption for PII at rest |
| `src/providers/CreditDataProvider.ts` | The port: what any data source must implement |
| `src/providers/SandboxProvider.ts` | Runnable fake data for local dev |
| `src/providers/AggregatorProvider.ts` | Adapter skeleton for a permissioned API |
| `src/normalize.ts` | Raw → normalized; cross-bureau dedup; negative-item detection |
| `src/storage.ts` | Profile store port + in-memory dev impl |
| `src/postgresStore.ts` | Durable Postgres store (JSONB, upsert, encrypted fields) |
| `migrations/001_init.sql` | Schema + security notes |
| `src/letters/templates.ts` | Per-reason templates with `{{field}}` injection |
| `src/letters/engine.ts` | Render + bureau routing + frivolous-basis guard |
| `src/service.ts` | Orchestration: pull → normalize → store, with retry/partials |
| `src/api.ts` | Express routes (+ CORS, + store selection) the dashboard calls |
| `web/creditApi.js` | Browser client for the API |
| `web/mapProfile.js` | Maps API profile → dashboard item shape |
| `web/MonitoringPanel.jsx` | Drop-in Credit Docket tab wiring pull + letters |
| `example.ts` | End-to-end run against the sandbox |

## Run it

```bash
npm install
export FIELD_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

npm run demo        # full pipeline against sandbox data
npm run typecheck   # strict tsc
npm test            # 14 tests (crypto, normalize, letters, service, postgres via pg-mem)
npm run api         # starts the API on :8787
```

Durable storage is opt-in: set `DATABASE_URL` (and `PGSSL=require` for managed
Postgres) and the API creates the table on boot and uses Postgres instead of
memory. See `.env.example`.

## Front end — `web/` (a standalone Vite app)

`web/` is now a runnable, deployable React app (its own `package.json`, separate
from the backend at the repo root).

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # parser tests (Vitest)
npm run build      # -> web/dist (deploy to Vercel / GitHub Pages)
```

Point it at your backend with `VITE_API_BASE` (see `web/.env.example`); only the
"Pull from bureaus" flow needs the API. Hosting steps are in `DEPLOY.md`.

**Getting reports in — two ways, both in the Monitoring tab:**

1. **Import from a report file** (`ReportUpload` + `reportParser.js`) — upload a
   PDF / HTML / text / JSON report from AnnualCreditReport.com or a monitoring
   service. Parsing runs **entirely in the browser** (the file is never uploaded),
   producing candidate items to review and correct before adding. Best-effort on
   PDF/HTML; deterministic on JSON. This path needs **no backend** and no bureau
   credentialing, since the consumer supplies their own report.
2. **Pull from all bureaus** (`MonitoringPanel` → `/api/pull`) — automated, but
   returns **sandbox data** until you swap `SandboxProvider → AggregatorProvider`
   with a credentialed permissioned aggregator.

Both paths feed the same "Add to workspace" bridge, so imported items appear in
Items, Tracking, and the Dashboard, and can drive the local Letters generator.

Front-end files (`web/src/`): `CreditDocket.jsx` (app, `localStorage` persistence),
`MonitoringPanel.jsx`, `ReportUpload.jsx`, `reportParser.js`, `creditApi.js`,
`mapProfile.js`, `main.jsx`.

> Not legal advice. Have counsel review your permissible-purpose basis, data
> security program, and (if you sell repair services) CROA compliance before launch.

> Not legal advice. Have counsel review your permissible-purpose basis, data
> security program, and (if you sell repair services) CROA compliance before launch.
