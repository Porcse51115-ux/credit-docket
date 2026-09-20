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

- **Monitoring module: complete and verified.** Strict type-check passes,
  10/10 tests green, demo + live API smoke-tested. Reproducible install
  (committed lockfile) and CI on every push.
- **Open seam:** the React dispute workbench (Credit Docket front end) is not yet
  wired to this API. Connecting the dashboard's `fetch` calls to `/api/pull` and
  `/api/letters` is the next step.
- **Storage** is in-memory (`InMemoryProfileStore`); profiles don't survive a
  restart. Swap in a durable store before real use.
- **License:** intentionally omitted — pick one before making the repo public
  (this is a commercial product, so an open MIT license is probably *not* what you want).

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
| `src/storage.ts` | Encrypted-at-rest profile store (port + in-memory dev impl) |
| `src/letters/templates.ts` | Per-reason templates with `{{field}}` injection |
| `src/letters/engine.ts` | Render + bureau routing + frivolous-basis guard |
| `src/service.ts` | Orchestration: pull → normalize → store, with retry/partials |
| `src/api.ts` | Express routes the Credit Docket app calls |
| `example.ts` | End-to-end run against the sandbox |

## Run the demo

```bash
npm install
export FIELD_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
npx tsx example.ts          # runs the full pipeline against sandbox data
npx tsx src/api.ts          # starts the API on :8787
```

## Wiring into Credit Docket (the React app)

The dashboard calls `GET /api/profile/:consumerId` to hydrate items, then
`POST /api/letters` with the selected item ids + reason codes to get
print-ready letters back. Map the API's `Tradeline`/`Inquiry` shapes onto the
existing `items` state — they were designed to line up.

> Not legal advice. Have counsel review your permissible-purpose basis, data
> security program, and (if you sell repair services) CROA compliance before launch.
