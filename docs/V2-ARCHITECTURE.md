# Credit Docket v2 — Architecture Plan

**Status:** Planning document, not yet executed
**Prerequisites:** Session 8 proper (launch) must ship first — v2 execution runs on post-launch signal
**Companion docs:**
- `docs/v2-reference/obsidian-docket/DESIGN.md` — source design system
- `docs/v2-reference/obsidian-docket/{homepage,pricing,dispute-engine,letters-tracking}/` — reference screens + HTML
- `docs/V2-TOKEN-MAP.md` — token translation lookup

This document answers: how does the current Credit Docket codebase (post-CD.2) get to Credit Docket v2 (Obsidian Docket aesthetic, full product)?

---

## Where we start (CD.2 shipped state)

**What exists on `main` right now:**
- TypeScript/Node backend with 46 passing tests
- `/api/letters`, `/api/pull`, `/api/profile`, `/health` endpoints
- Vite + React 18 frontend
- Tailwind + shadcn/ui foundation (10 components)
- Credit Docket cream palette as HSL CSS vars
- Fraunces + Inter + IBM Plex Mono via Google Fonts
- 240px dark sidebar layout, 1400px main content area
- 8-tab workbench (Dashboard, Profile, Monitoring, Items, Letters, Goodwill, Tracking, Fast track)
- Design tokens plumbed through — all colors flow through `C` object sourcing from CSS vars
- Session CD.1 readiness hardening (request logging, DB health probe, profile gates)

**Preserved behaviors (do not touch during v2):**
- All backend code — the whole TypeScript API layer stays
- The content-hash ID system (`tl_`, `iq_`, `pr_` identifiers)
- Envelope encryption of account numbers
- The `web/src/schemas/` Zod schemas (byte-identical to Docket Strategist's Pydantic side — breaks the cross-language contract if touched)
- The 46 passing tests must still pass
- All inline tab content JSX works and renders

**What v2 changes:** visual identity, typography, color palette, elevation system, page structure, marketing surface. The product's engineering remains the same.

---

## What v2 is (scope lock-in)

Per the Obsidian Docket reference materials, v2 includes **both**:

### Marketing surface (new)
- Homepage (landing page) — currently nonexistent
- Pricing page — currently nonexistent
- Public-facing nav (Overview, Bureau Sync, Dispute Engine, Letters & Tracking, Pricing)

### Workbench surface (rebuilt from current CD.2)
- Dispute Engine (replaces current Items + Letters + Monitoring tabs)
- Letters & Tracking (replaces current Tracking + Goodwill tabs)
- Bureau Sync (new; replaces current Monitoring tab's bureau-pull functionality)
- Overview (replaces current Dashboard tab)

**Current CD.2 8-tab structure doesn't survive.** The v2 workbench consolidates to roughly 4 main sections with richer internal structure.

---

## Approach (phased, not big-bang)

A full v2 rewrite in one session is possible but risky. A phased approach lets each phase ship as a working artifact without breaking the live product.

### Phase 1: Foundation (4-6 hours)
Install everything v2 needs without touching current UI.

- [ ] Add Playfair Display + Space Grotesk to Google Fonts import (keep existing Inter/Fraunces for backwards compatibility until Phase 3)
- [ ] Add v2 palette to `index.css` as a new `[data-theme="obsidian"]` block alongside the current `:root` default
- [ ] Add new tokens from `V2-TOKEN-MAP.md`: glass tiers, glow shadows, chart colors
- [ ] Add `font-display-serif` (Playfair) alongside `font-display` (Fraunces) in Tailwind config
- [ ] Add new shadcn components the reference uses but we don't have yet: `tooltip`, `scroll-area`, `progress`, `avatar`, `switch`, `dialog`, `select`, `dropdown-menu`, `popover`, `sheet`

**Deliverable:** `obsidian` theme available via theme toggle, but no screens use it yet. Current CD.2 unchanged.

### Phase 2: Marketing surface (6-10 hours)
Build the homepage + pricing page from scratch. These don't replace anything.

- [ ] Create `web/src/screens/marketing/Homepage.jsx` — port the reference `homepage/code.html` structure to React with real Credit Docket content
- [ ] Create `web/src/screens/marketing/Pricing.jsx` — port `pricing/code.html` with real tier definitions (TBD based on actual pricing strategy)
- [ ] Create `web/src/components/marketing/` — reusable marketing components (hero, feature grid, CTA block, pricing card)
- [ ] Add React Router for `/`, `/pricing`, `/app` (workbench) routes
- [ ] Port the three.js hero animation from `three.js.html` into a React component (`web/src/components/marketing/HeroCanvas.jsx`)
- [ ] Build the dark marketing nav with "START DISPUTE" CTA

**Deliverable:** Public-facing pages live at `/` and `/pricing`. Workbench still at `/app` using current CD.2 UI.

### Phase 3: Workbench rebuild (10-14 hours)
Rebuild the workbench to match the reference Dispute Engine + Letters & Tracking screens, consolidating the 8-tab structure.

- [ ] Build `web/src/screens/workbench/Overview.jsx` — replaces current Dashboard with the Obsidian version (bureau health panel, 30-day timer, score trajectory, next actions)
- [ ] Build `web/src/screens/workbench/DisputeEngine.jsx` — the full dispute engine page: item cards with bureau-column grids, violation badges, strategy recommendations, live dossier preview
- [ ] Build `web/src/screens/workbench/LettersTracking.jsx` — metric header, active clock timeline, postal ledger, brief library
- [ ] Build `web/src/screens/workbench/BureauSync.jsx` — connection/pull/status page (new, extracted from current Monitoring)
- [ ] Build `web/src/screens/workbench/Profile.jsx` — port existing Profile tab into v2 styling
- [ ] Build `web/src/screens/workbench/Fast track.jsx` or integrate into Overview — TBD
- [ ] Build the dark top-bar workbench nav matching the reference

**At the end of Phase 3**, the current CD.2 sidebar layout can be removed. Keep it in a `legacy/` branch for reference if needed.

**Deliverable:** Full product on Obsidian Docket aesthetic. Launch v2 marketing + workbench together.

### Phase 4: Polish + light mode (2-4 hours)
- [ ] Light mode variant of the v2 palette
- [ ] Theme toggle in nav
- [ ] Keyboard navigation audit
- [ ] Accessibility pass (contrast ratios, focus states, screen reader labels)
- [ ] Mobile responsive polish (reference specifies 4-col mobile reflow)

**Deliverable:** Production-ready v2.

---

## Honest effort estimate

| Phase | Low | High |
|---|---|---|
| 1 | 4h | 6h |
| 2 | 6h | 10h |
| 3 | 10h | 14h |
| 4 | 2h | 4h |
| **Total** | **22h** | **34h** |

Handoff Section 9 estimated 15-25 hours. The high end of 34h accounts for the three.js hero animation and the marketing surface being fully new work rather than theming.

Realistic cadence: 4-6 sessions of 60-90 min each per phase, so **16-24 sessions total**. Spread across 4-6 weeks post-launch.

---

## Decisions pending (resolve before execution)

1. **Pricing strategy** — the reference shows $49/$99/$249 tiers. Real pricing TBD. Can ship marketing surface with "TBD" or placeholder pricing initially.
2. **Marketing surface hosting** — is the homepage served from the same Vite build as the app, or separate? Impacts routing, SEO, deploy pipeline.
3. **Mono font** — stay with IBM Plex Mono for code/hashes, or switch to a Space Grotesk mono variant? Reference doesn't specify.
4. **three.js hero complexity** — the reference `three.js.html` is a specific animation. Keep as-is, simplify, or replace with a static SVG for lower bundle size? Impacts Phase 2 estimate.
5. **Legacy CD.2 sidebar** — delete entirely after Phase 3, or keep as `/app-legacy` route for users who prefer it?

Each decision pins down a phase before it starts.

---

## What NOT to do

- **Don't start v2 execution before Session 8 launch ships.** The whole sequencing argument is: launch v1, learn, then build v2 informed by what you learned.
- **Don't touch the backend.** All API endpoints, encryption, schemas, storage layer stays untouched. v2 is a frontend project.
- **Don't break the Docket Strategist contract.** The `web/src/schemas/` Zod schemas stay byte-identical to the Python side.
- **Don't rebuild the current CD.2 sidebar in Obsidian styling as a shortcut.** Phase 3 is a real rebuild, not a re-skin. The information architecture changes.
- **Don't invent new components that don't appear in the reference.** The reference screens define the component vocabulary. If a new need appears mid-execution, document it in a `TOKEN-DECISIONS.md` log and justify it before building.
- **Don't ship Phase 1 or Phase 2 as "v2 launched."** v2 launches with Phase 3 complete.

---

## Kickoff for v2 execution (future)

When CD v2 Phase 1 session begins:

> Continuing from `docs/V2-ARCHITECTURE.md`. Session 8 shipped, v1 launched. Ready to start Phase 1 of v2: foundation install (Playfair Display + Space Grotesk, Obsidian palette as alternate theme, new shadcn components). Design reference is in `docs/v2-reference/obsidian-docket/`. Token map is in `docs/V2-TOKEN-MAP.md`. Backend untouched throughout v2.

---

## Appendix: reference materials

- `docs/v2-reference/obsidian-docket/DESIGN.md` — authoritative design spec (M3 tokens, typography, elevation, components)
- `docs/v2-reference/obsidian-docket/homepage/screen.png` + `code.html` — marketing homepage
- `docs/v2-reference/obsidian-docket/pricing/screen.png` + `code.html` — pricing page
- `docs/v2-reference/obsidian-docket/dispute-engine/screen.png` + `code.html` — workbench Dispute Engine page
- `docs/v2-reference/obsidian-docket/letters-tracking/screen.png` + `code.html` — workbench Letters & Tracking page
- `docs/v2-reference/obsidian-docket/three.js.html` — hero animation reference code

Reference folder is read-only reference material. Don't edit — if changes to the design system are needed, create a `V2-DESIGN-DECISIONS.md` log at the docs root documenting what diverged from the reference and why.
