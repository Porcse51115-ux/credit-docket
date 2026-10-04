# Credit Docket v2 — Token Map

**Status:** Planning document, not applied code
**Source:** `docs/v2-reference/obsidian-docket/DESIGN.md` (Obsidian Docket, Stitch-generated)
**Target:** Credit Docket's shadcn/ui + Tailwind token system (`web/src/index.css`, `web/tailwind.config.js`)
**Dark primary / light optional** per the agreed v2 scope.

This document maps every design token from the Obsidian Docket reference spec to the equivalent shadcn/Tailwind token Credit Docket's current CSS variable system already uses. When CD v2 execution starts, this map is the lookup table that answers "what CSS variable do I change for X."

---

## Palette translation (dark mode primary)

### Backgrounds and surfaces

| Obsidian Docket M3 token | Hex | Our shadcn token | Our CSS var | Notes |
|---|---|---|---|---|
| `surface` / `background` | `#10131a` | `background` | `--background` | The pure obsidian canvas — root of the dark theme |
| `surface-container-lowest` | `#0b0e15` | `--background-deeper` (new) | `--background-deeper` | Add as a new token for deep-canvas sections |
| `surface-container-low` | `#191b23` | `card` | `--card` | Cards sit one tier above the canvas |
| `surface-container` | `#1d1f27` | `secondary` | `--secondary` | Section containers, inner surfaces |
| `surface-container-high` | `#272a32` | `muted` | `--muted` | Hover states, disabled regions |
| `surface-container-highest` | `#32353d` | `accent` | `--accent` | Deepest elevated surfaces |
| `outline` | `#86948a` | `border` | `--border` | Divider lines |
| `outline-variant` | `#3c4a42` | `input` | `--input` | Input field borders, muted divisions |

### Foreground / text

| Obsidian Docket token | Hex | Our shadcn token | Our CSS var |
|---|---|---|---|
| `on-surface` | `#e1e2ec` | `foreground` | `--foreground` |
| `on-surface-variant` | `#bbcabf` | `muted-foreground` | `--muted-foreground` |
| Text Tertiary (`#475569`) | `#475569` | `--text-tertiary` (new) | `--text-tertiary` |

### Primary accent (mint/emerald)

| Obsidian Docket token | Hex | Our shadcn token | Our CSS var |
|---|---|---|---|
| `primary` | `#4edea3` | `primary` | `--primary` |
| `primary-container` | `#10b981` | `--primary-strong` (new) | `--primary-strong` |
| `on-primary` | `#003824` | `primary-foreground` | `--primary-foreground` |
| `inverse-primary` | `#006c49` | `--primary-muted` (new) | `--primary-muted` |

Credit Docket's current primary is `#0F6E5C` (CD.1 green). Obsidian Docket shifts to a brighter mint (`#4edea3`) because dark backgrounds need higher-luminance accents. The warmer `#10b981` emerald is kept as `primary-strong` for CTAs and hover states.

### Secondary / warning (amber)

| Obsidian Docket token | Hex | Our shadcn token | Our CSS var |
|---|---|---|---|
| `secondary` | `#ffb95f` | `warning` | `--warning` |
| `secondary-container` | `#ee9800` | `--warning-strong` (new) | `--warning-strong` |

Current Credit Docket uses `#9A6B12` for amber; the brighter `#ffb95f` is dark-mode-correct.

### Destructive / error

| Obsidian Docket token | Hex | Our shadcn token | Our CSS var |
|---|---|---|---|
| `error` | `#ffb4ab` | `destructive-foreground` | `--destructive-foreground` |
| `error-container` | `#93000a` | `destructive` | `--destructive` |

### Tertiary (bright mint variant for data viz)

| Obsidian Docket token | Hex | Our shadcn token | Our CSS var |
|---|---|---|---|
| `tertiary` | `#45dfa4` | `--chart-primary` (new) | `--chart-primary` |
| `tertiary-container` | `#00b982` | `--chart-primary-dark` (new) | `--chart-primary-dark` |

Reserved for charts, data visualizations, trajectory lines. The spec uses it in the "Statutory Enforcement Efficacy" bar chart.

---

## Translucent / glass surfaces

Obsidian Docket's visual identity leans heavily on frosted glassmorphism. Current Credit Docket uses solid cards. These are additions, not replacements.

Add these to the CSS variable system as separate values from the solid surfaces above:

```css
--glass-tier-1: rgba(15, 23, 42, 0.65);     /* Base plates, metric cards */
--glass-tier-2: rgba(30, 41, 59, 0.75);     /* Elevated / hover state */
--glass-tier-3: rgba(15, 23, 42, 0.92);     /* Active overlays, modals */
--glass-edge: rgba(255, 255, 255, 0.08);     /* Hairline border */
--glass-edge-highlight: rgba(255, 255, 255, 0.12);  /* Inner top-edge */
```

Applied with `backdrop-filter: blur(16px)` (Tier 1) / `blur(20px)` (Tier 2) / `blur(24px)` (Tier 3).

The spec also calls for ambient glow shadows:

```css
--glow-ambient-dark: 0 12px 32px -8px rgba(0, 0, 0, 0.6);
--glow-primary: 0 0 20px rgba(16, 185, 129, 0.35);
--glow-primary-soft: 0 0 40px -10px rgba(16, 185, 129, 0.15);
```

---

## Typography

Current Credit Docket: Fraunces (display) + Inter (sans) + IBM Plex Mono (mono).
Obsidian Docket: **Playfair Display** (display) + **Space Grotesk** (sans + metrics). No separate mono family.

### Decision: adopt Obsidian Docket's typography

Reason: Playfair Display is a higher-contrast serif that reads as more institutional/private-banking than Fraunces. Space Grotesk is a tighter geometric sans with better numeric legibility for metric displays than Inter. Credit Docket v2's whole point is institutional-grade authority, so the typography should reflect it.

Mono use case (code blocks, system identifiers, cryptographic hashes shown in the "Chain of Custody" section) stays with IBM Plex Mono or shifts to a Space Grotesk mono variant — decide at execution time.

### Type scale translation

| Obsidian token | Font | Size | Weight | Line | Letter | Tailwind class (proposed) |
|---|---|---|---|---|---|---|
| `display-lg` | Playfair Display | 48px | 600 | 56px | -0.02em | `text-5xl font-display font-semibold tracking-tight` |
| `display-lg-mobile` | Playfair Display | 34px | 600 | 42px | -0.015em | `text-4xl font-display font-semibold` |
| `headline-lg` | Playfair Display | 32px | 600 | 40px | -0.01em | `text-3xl font-display font-semibold` |
| `headline-md` | Playfair Display | 24px | 500 | 32px | — | `text-2xl font-display font-medium` |
| `headline-sm` | Playfair Display | 20px | 500 | 28px | — | `text-xl font-display font-medium` |
| `metric-xl` | Space Grotesk | 44px | 700 | 48px | -0.03em | `text-[44px] font-sans font-bold tracking-tighter` |
| `metric-lg` | Space Grotesk | 32px | 700 | 36px | -0.02em | `text-3xl font-sans font-bold tracking-tight` |
| `body-lg` | Space Grotesk | 16px | 400 | 24px | — | `text-base font-sans` |
| `body-md` | Space Grotesk | 14px | 400 | 20px | — | `text-sm font-sans` |
| `label-lg` | Space Grotesk | 12px | 600 | 16px | 0.08em | `text-xs font-sans font-semibold uppercase tracking-wider` |
| `label-sm` | Space Grotesk | 10px | 600 | 14px | 0.1em | `text-[10px] font-sans font-semibold uppercase tracking-widest` |

Tailwind config addition:

```js
fontFamily: {
  sans: ["Space Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
  display: ["Playfair Display", "Georgia", "serif"],
  mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],  // keep for now
}
```

Google Fonts URL for `src/index.css`:

@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');


---

## Spacing and radii

Obsidian Docket's radii:

| Token | Value | Our Tailwind class |
|---|---|---|
| `sm` | 0.25rem (4px) | `rounded-sm` |
| default | 0.5rem (8px) | `rounded` |
| `md` | 0.75rem (12px) | `rounded-md` |
| `lg` | 1rem (16px) | `rounded-lg` |
| `xl` | 1.5rem (24px) | `rounded-xl` |
| `full` | 9999px | `rounded-full` |

These match Tailwind defaults closely — no custom config needed beyond what's already there.

Spacing scale uses standard Tailwind `space-*` utilities, no custom tokens.

**Grid architecture:**
- Desktop (1024px+): 12-column, max-width `1440px`, gutter `20px`, outer margin `32px`
- Tablet (768-1023px): 8-column, metric cards collapse to 4-col spans
- Mobile (<768px): 4-column reflow, full-width stacked cards, 16px margins, 12px gutters

Current CD.2 uses `max-w-[1400px]` already — close enough. Minor adjustment to 1440px during execution.

---

## Light mode

Dark is primary per our agreement, but light-mode variants of the full M3 palette can be derived systematically:

- Invert `surface` → `on-surface` and swap tiers
- Primary mint shifts darker for AA contrast on light backgrounds (`#047857` or similar)
- Amber shifts to its secondary-container value (`#ee9800`)

Light mode is NOT in the reference design. Can be derived using M3 color-space tooling (Material Theme Builder, Radix Colors) at execution time or deferred to post-launch.

---

## Fallback strategy

If any token needs a value not yet specified by the reference:
1. Pick the nearest neighbor in the M3 palette above
2. Document the pick in a `TOKEN-DECISIONS.md` log as execution happens
3. If an entirely new semantic token is needed, add it following M3 naming (e.g., `--chart-tertiary`, `--notification-info`)

Don't add arbitrary new colors. The whole point of Obsidian Docket's palette is that it's a complete, closed system.
