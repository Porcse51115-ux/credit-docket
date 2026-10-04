# v2 Reference Materials

Source materials for the Credit Docket v2 redesign. Read-only.

**All execution planning lives one level up:**
- `../V2-ARCHITECTURE.md` — phased build plan + decisions pending
- `../V2-TOKEN-MAP.md` — M3 token translation to shadcn/Tailwind

---

## obsidian-docket/

The "Obsidian Docket" design system — a cinematic dark-mode fintech aesthetic generated via Stitch, hand-reviewed and locked in as the v2 target.

### Structure

obsidian-docket/
├── DESIGN.md Master design spec (230 lines)
│ M3 color tokens, typography scale,
│ elevation tiers, component vocabulary,
│ brand philosophy
│
├── three.js.html Hero animation reference code
│ (homepage decorative element)
│
├── homepage/ Marketing landing page
│ ├── code.html Full-page HTML reference
│ └── screen.png Rendered mockup
│
├── pricing/ Pricing + plan comparison page
│ ├── code.html Three-tier plan grid, feature matrix, FAQ
│ └── screen.png Rendered mockup
│
├── dispute-engine/ Workbench — Dispute Engine screen
│ ├── code.html Item cards with bureau grids, violation
│ │ badges, strategy recommendations, live
│ │ dossier preview
│ └── screen.png Rendered mockup
│
└── letters-tracking/ Workbench — Letters & Tracking screen
├── code.html Statutory countdown, postal ledger,
│ brief library
└── screen.png Rendered mockup


### Scope the reference covers

- Marketing surface (homepage, pricing)
- Workbench UI (two example pages — the rest of the workbench extrapolates from these patterns)

### Scope the reference does NOT cover (yet)

- Dashboard / Overview page
- Bureau Sync page (new in v2 but not mocked)
- Profile / account settings
- Fast track / Strategy page
- Mobile layouts (DESIGN.md specifies breakpoints but screens are desktop)
- Light mode (dark primary per our scope — light derivation is Phase 4 work)

For any screen not in the reference, extrapolate using the design system in `DESIGN.md` + the component vocabulary established by the four reference screens.

---

## Attribution

Generated via Stitch (Google's design tool), named "Obsidian Docket," refined through iteration. The design philosophy ("Cinematic Glassmorphism & Sovereign Precision") is spelled out in `DESIGN.md`.

Credit Docket v1 (CD.1 + CD.2) used a different aesthetic — cream palette, Fraunces serif, lighter-weight institutional feel. v2 shifts to this darker, more cinematic institutional aesthetic while preserving all backend engineering and the cross-language ID contract with Docket Strategist.

---

## When executing v2

1. Read `../V2-ARCHITECTURE.md` first — phase breakdown and what order to build
2. Reference `../V2-TOKEN-MAP.md` as the lookup table for every color/typography decision
3. Open the relevant `screen.png` + `code.html` for the page you're building
4. Treat the HTML as reference, not drop-in code — it's single-page static HTML, not React components
5. Preserve current backend behavior throughout (`../V2-ARCHITECTURE.md` has the "do not touch" list)
