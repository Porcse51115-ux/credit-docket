// api.ts — the service/API layer the existing Credit Docket app calls.
//
// Endpoints:
//   GET  /health                   -> liveness
//   POST /api/pull                 -> trigger a tri-bureau pull for a consumer
//   GET  /api/profile/:consumerId  -> normalized items for the dashboard
//   POST /api/letters              -> generate dispute letters for selected items
//
// Auth note: protect these with your app's session/JWT and role checks. Only
// masked account numbers are ever returned; full numbers stay encrypted at rest.

import express, { Request, Response, NextFunction } from "express";
import { MonitoringService } from "./service";
import { FieldCrypto, LocalMasterKey } from "./crypto";
import { InMemoryProfileStore } from "./storage";
import { SandboxProvider } from "./providers/SandboxProvider";
import { generateLetters, LetterRequest, Sender } from "./letters/engine";
import { ALL_BUREAUS, CreditProfile, Tradeline } from "./types";

// --- wiring (swap SandboxProvider for AggregatorProvider in production) ---
const crypto = new FieldCrypto(new LocalMasterKey());
const store = new InMemoryProfileStore();
const provider = new SandboxProvider();
const service = new MonitoringService(provider, crypto, store);

const app = express();
app.use(express.json());

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

app.get("/health", (_req: Request, res: Response) => res.json({ ok: true, provider: provider.name }));

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
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => console.log(`monitoring API on :${PORT} (provider: ${provider.name})`));
}

export { app };
