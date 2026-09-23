# Deploy notes

Two pieces deploy separately: a **static front end** and a **Node backend**.

## Front end (`web/`) — static, host anywhere

`npm run build` in `web/` produces `web/dist`, a static bundle.

**Vercel**
- Import the repo; set **Root Directory** = `web`.
- Framework preset: Vite. Build: `npm run build`. Output: `dist`.
- Env var: `VITE_API_BASE` = your backend URL.

**GitHub Pages**
- `vite.config.js` already sets `base: "./"`, so relative asset paths work on a
  project site (`<user>.github.io/<repo>/`).
- Build `web/dist` and publish it (a Pages Action, or push `dist` to a `gh-pages`
  branch). Set `VITE_API_BASE` at build time.

> The upload/parse flow works on a purely static deploy with **no backend** — the
> file is parsed in the browser. Only "Pull from bureaus" needs the API below.

## Backend (repo root) — needs a Node runtime

This is an Express server, so it does **not** run on GitHub Pages (static only).
Use a Node host (Render, Railway, Fly.io) or Vercel Functions.

Required env:
- `FIELD_MASTER_KEY` — 32 bytes, base64. In production use a real KMS, not a
  committed key.
- `DATABASE_URL` (+ `PGSSL=require` for managed Postgres) — else it runs
  in-memory and forgets on restart.
- `WEB_ORIGIN` — your deployed front-end origin, so CORS allows it.

Build/run: `npm ci && npm run api` (or compile with `tsc` and run the JS).

## Before real consumer data

- Swap `SandboxProvider → AggregatorProvider` only once you're credentialed with
  a permissioned aggregator (FCRA permissible purpose).
- Put your auth/session guard in front of the `/api/*` routes.
- Enable disk encryption at rest on the database; keep the KMS master key out of
  the app and out of git.
