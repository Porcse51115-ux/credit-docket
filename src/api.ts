// api.ts — the service/API layer the Credit Docket dashboard calls.
//
// Endpoints:
//   GET  /health                   -> liveness
//   POST /api/pull                 -> trigger a tri-bureau pull for a consumer
//   GET  /api/profile/:consumerId  -> normalized items for the dashboard
//   POST /api/letters              -> generate dispute letters for selected items
//
// Store: in-memory by default; Postgres when DATABASE_URL is set.
// CORS: browser origin allowed via WEB_ORIGIN (defaults to * for local dev).
// Auth note: protect these with your app's session/JWT and role checks. Only
// masked account numbers are ever returned; full numbers stay encrypted at rest.

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { MonitoringService } from "./service";
import { FieldCrypto, LocalMasterKey } from "./crypto";
import { InMemoryProfileStore, ProfileStore } from "./storage";
import { PostgresProfileStore } from "./postgresStore";
import { SandboxProvider } from "./providers/SandboxProvider";
import { generateLetters, LetterRequest, Sender } from "./letters/engine";
import { ALL_BUREAUS, CreditProfile, Tradeline } from "./types";

// --- wiring (swap SandboxProvider for AggregatorProvider in production) ---
const crypto = new FieldCrypto(new LocalMasterKey());
const provider = new SandboxProvider();

// Store is chosen at boot. Routes close over this variable, so main() can swap
// in Postgres before the server starts listening.
let store: ProfileStore = new InMemoryProfileStore();
let service = new MonitoringService(provider, crypto, store);

async function selectStore(): Promise<string> {
  if (!process.env.DATABASE_URL) return "in-memory";
  const pg = await import("pg");
  const pool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === "require" ? { rejectUnauthorized: false } : undefined,
  });
  const pgStore = new PostgresProfileStore(pool);
  await pgStore.ensureSchema();
  store = pgStore;
  service = new MonitoringService(provider, crypto, store);
  return "postgres";
}

const app = express();
app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
app.use(express.json());

// Request logger — logs method, path, status, and duration for every request.
// Uses console.log so it flows through the same stream as the startup banner.
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
});

// Strip server-only fields before sending to the client.
function publicProfile(p: CreditProfile) {
  return {
    ...p,
    tradelines: p.tradelines.map((t) => {
      const copy: Partial<Tradeline> = { ...t };
      delete copy.accountNumberEnc;
      return copy;
    }),
  };
}

const asyncRoute =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

app.get("/health", async (_req: Request, res: Response) => {
  const dbOk = await store.healthCheck();
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    provider: provider.name,
    store: store.constructor.name === "PostgresProfileStore" ? "postgres" : "in-memory",
    dbOk,
  });
});

app.post("/api/pull", asyncRoute(async (req: Request, res: Response) => {
  const { consumerId, consentToken, bureaus } = req.body ?? {};
  if (!consumerId || !consentToken) {
    return res.status(400).json({ error: "consumerId and consentToken are required" });
  }
  try {
    const profile = await service.pullAndStore({
      consumerId,
      consentToken,
      bureaus: bureaus ?? ALL_BUREAUS,
      permissiblePurpose: "consumer-initiated review (15 U.S.C. 1681b(a)(2))",
    });
    res.json({ partial: profile.partial, diagnostics: profile.diagnostics, profile: publicProfile(profile) });
  } catch (e) {
    res.status(502).json({ error: "pull_failed", detail: e instanceof Error ? e.message : String(e) });
  }
}));

app.get("/api/profile/:consumerId", asyncRoute(async (req: Request, res: Response) => {
  const stored = await store.get(req.params.consumerId);
  if (!stored) return res.status(404).json({ error: "not_found" });
  res.json({ profile: publicProfile(stored.profile) });
}));

app.post("/api/letters", asyncRoute(async (req: Request, res: Response) => {
  const { consumerId, sender, disputes } = req.body as {
    consumerId: string; sender: Sender; disputes: LetterRequest[];
  };
  const stored = await store.get(consumerId);
  if (!stored) return res.status(404).json({ error: "profile_not_found" });
  if (!Array.isArray(disputes) || disputes.length === 0) {
    return res.status(400).json({ error: "no disputes selected" });
  }
  // `skipped` tells the UI which items need a basis before they can be disputed.
  res.json(generateLetters(stored.profile, sender ?? ({} as Sender), disputes));
}));

app.use((_req: Request, res: Response) => res.status(404).json({ error: "route_not_found" }));

const PORT = Number(process.env.PORT ?? 8787);

/**
 * Startup env warnings for optional vars that silently fall back to permissive
 * defaults. Required vars are validated at import time by their consumers
 * (FIELD_MASTER_KEY is checked in LocalMasterKey; PORT has a sane default).
 */
function warnAboutMissingEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.warn("WARN: DATABASE_URL not set — falling back to in-memory store.");
    console.warn("      Data will be lost on restart. Set DATABASE_URL in .env for durable storage.");
  }
  if (!process.env.WEB_ORIGIN) {
    console.warn("NOTE: WEB_ORIGIN not set — CORS is open to *. Set WEB_ORIGIN in .env for production.");
  }
}

if (process.env.NODE_ENV !== "test") {
  warnAboutMissingEnv();
  selectStore()
    .then((kind) => app.listen(PORT, () => console.log(`monitoring API on :${PORT} (provider: ${provider.name}, store: ${kind})`)))
    .catch((e) => { console.error("store init failed:", e); process.exit(1); });
}

export { app };
