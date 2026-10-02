# Nursery Link Uganda — design plan

Visual and interaction foundations for `apps/web` and `apps/admin`. Approved before implementation; tokens live in `packages/ui/src/tokens.css`.

## A1. Colour (6 named colours + functional tints)

| Name | Hex | Role | Contrast |
|---|---|---|---|
| **Canopy** | `#0F2E1D` | Headings, app bar, map pin outlines, dark surfaces | 14.7:1 on white |
| **Forest** | `#1B5E3A` | Primary: buttons, links, selected states, focus ring | 7.75:1 on white; white on it 7.75:1 |
| **Seedling** | `#247A3B` | Positive states only: "In stock", "Paid", success toasts, the growth-timeline line | 5.35:1 on white, 4.91:1 on Mist |
| **Sun** | `#FFC928` | **Only** for free-seedling gift pins and campaign elements (FR-17); never for warnings | Always paired with Canopy text or stroke (9.54:1). Never used as text or on white without a Canopy outline (1.5:1) |
| **Mist** | `#F3F6F1` | Page background: a neutral, slightly green light surface; cards are white on Mist | — |
| **Bark** | `#1B2420` | Body text | 14.6:1 on Mist |

**Functional tints (not brand colours):**
- **Text:** Bark-muted `#4F5E55` for secondary text (6.3:1 on Mist).
- **Lines:** `#D3DDD2` for dividers only. `#6E7D73` for input and checkbox borders (≥3.98:1, meets WCAG 1.4.11).
- **Seedling tint:** `#DDF2DC`, the badge background, with Forest or Canopy text on it.
- **Stale-stock amber:** `#8A5300` text on `#FFF1DB` (5.68:1), always as an outlined badge with a clock icon, so it can never be mistaken for Sun.
- **Laterite red:** `#B42318` on `#FDECEA` (5.75:1) for errors, forest-loss cells and shadow zones (admin).

All colours are CSS variables in `packages/ui/src/tokens.css` (`--color-forest`, …), exposed to Tailwind through `@theme`. Apps never use raw hex.

## A2. Typefaces

| Face | Role | Why |
|---|---|---|
| **Atkinson Hyperlegible Next** (variable; self-hosted woff2, Latin subset ≈ 30 KB) | All UI and body text, prices, phone numbers | Designed by the Braille Institute for legibility. Letters that are easy to confuse (I/l/1, O/0, 5/S) are distinct, which matters for mixed literacy and for reading `UGX 1,500` and `+256 772 123 456` correctly. |
| **Source Serif 4 Italic** (self-hosted; loaded only on Library routes) | Scientific names (*Milicia excelsa*) and specimen-sheet headings | Scientific names are italicised by botanical convention. Keeping the serif to the Library spends the "boldness" in one place. |
| System monospace | Order short codes (`K7Q2MX`) and coordinates in admin | Makes codes and coordinates easy to read out and copy. |

- **Self-hosted:** fonts come from `@fontsource`, with no Google Fonts requests. That's better for privacy (Data Protection Act 2019), offline use and data cost.
- **Fallback:** if the variable "Next" package isn't on fontsource, I'll use the static Atkinson Hyperlegible 400/700.

## A3. Type scale (mobile-first, 16 px base, ratio ≈ 1.2)

| Token | Size / line height | Use |
|---|---|---|
| `text-xs` | 13 / 18 | Map attribution and legal text only (never for actions) |
| `text-sm` | 14 / 20 | Meta: distances, "Stock updated 3 days ago" |
| `text-base` | 16 / 24 | Body, inputs, list rows (inputs at ≥16 px stop iOS zooming in) |
| `text-lg` | 18 / 26 | Card titles, prices |
| `text-xl` | 22 / 28 | Section headings |
| `text-2xl` | 28 / 34 | Page titles |
| `text-3xl` | 34 / 40 | Species common name on the specimen sheet; desktop only for the Home search prompt |

- **Weights:** 400 and 700 only, which keeps font bytes down.
- **Capitals:** sentence case everywhere, with no all-caps eyebrow labels.
- **Numbers:** tabular numerals for prices and quantities.

## A4. Spacing, radius, elevation, motion

- **Spacing (4 px base):** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Page gutter 16 px on mobile, 24 px on desktop.
- **Tap targets:** at least **44 × 44 px** everywhere, including steppers, chips, OTP boxes and map controls.
- **Radius:** 6 px for inputs and buttons, 10 px for cards and panels, 16 px for the top corners of bottom sheets and drawers, full for chips, avatars and pins.
- **Elevation:** almost none. Most separation comes from a white card on Mist plus a 1 px `#D3DDD2` line. Shadows only on floating layers: the bottom sheet, the drawer, the map popover and toasts. No identical shadowed cards everywhere.
- **Motion:** 150–220 ms ease-out, only to show a change: the drawer or sheet opening, an order-status step advancing, a toast arriving. All of it is disabled under `prefers-reduced-motion`. No gradients, no parallax, no decorative animation.

## A5. Iconography and imagery (NFR-3.2)

- **Icons:** lucide-react for UI icons, plus custom SVGs in `packages/ui/icons` for the domain categories. Every category chip shows an icon and a short label.
  - **Species:** Indigenous (broadleaf tree), Agroforestry (tree beside a crop row), Exotic (pine), Ornamental (flowering tree), Medicinal (leaf with a cross).
  - **News:** Weather (cloud and rain), Market (price tag), Policy (document with seal), Grant (hand with coin).
  - **Stock categories on nursery cards:** the same species-category icons.
- **Photos:** photos appear where they help recognition (species thumbnails, the specimen gallery), as WebP at fixed dimensions (480/960 widths via `srcset`), lazy-loaded.
- **Map pins:** custom SVG pins with a Canopy outline.
  - **Normal:** Forest fill with a white seedling glyph.
  - **Gift:** Sun fill with a Canopy gift glyph, slightly larger (FR-17).
  - **Selected:** Canopy fill, a white ring and a raised scale.
  - **Clusters:** a Forest circle showing the count. A small Sun badge appears when the cluster contains a gift nursery.
  - **Screen readers:** every pin has an `aria-label`, for example "Mukono Town Nursery, 4.2 km by road, free seedlings available".

## A6. Formatting and copy rules

- **Money:** `UGX 1,500` (Intl `en-UG`, no decimals).
- **Distance:** `4.2 km by road`, or `≈ 4.2 km (approx.)` when `distance_mode = straight_line`.
- **Phone numbers:** `+256 772 123 456`, with tap-to-call `tel:+256772123456`.
- **Dates:** relative for freshness ("3 days ago"), absolute for orders ("30 Sep 2026, 14:05").
- **Copy location:** all copy lives in `src/copy/en.ts` for each app.
- **Action names:** an action keeps its name through its flow: **Order & deliver** → "Review order" → **Pay UGX 45,000** → "Order placed".

## A7. Wireframes

**Home `/` (mobile, 375 px)**
```
┌─────────────────────────────────┐
│ ☰  🌱 Nursery Link      Sign in │  app bar (Canopy)
├─────────────────────────────────┤
│ Find trees near you             │  text-2xl
│ ┌─────────────────────────────┐ │
│ │ 🔍 Search a tree or nursery │ │  main element, 52 px tall
│ └─────────────────────────────┘ │
│ [📍 Use my location]            │  44 px secondary button
│                                 │
│ ┌──────────┐ ┌──────────┐       │  4 module tiles (icon + label)
│ │ 🗺 Find   │ │ 🎁 Free   │       │   Nurseries  · Free seedlings
│ │ nurseries│ │ seedlings│       │   Tree library · News
│ ├──────────┤ ├──────────┤       │
│ │ 📖 Tree   │ │ 📰 News & │       │
│ │ library  │ │ advice   │       │
│ └──────────┘ └──────────┘       │
│ Free seedlings near you   All › │
│ ┌─────────────────────────────┐ │  horizontal scroll strip
│ │🎁 Lake Victoria shoreline…  │ │  Sun left rule + gift icon
│ │  Katosi · ████████░░ 67% left│ │
│ └─────────────────────────────┘ │
│ Latest advice             All › │
│ ☁ Short rains start mid-Oct…    │  3 rows, icon + title + date
│ 🏷 Mvule seedling prices up…     │
└─────────────────────────────────┘
```
On desktop the search sits at the top of a two-column layout, with the module tiles in one row and campaigns and advice side by side.

**Nurseries `/nurseries`, desktop (1280 px)**
```
┌────────────────────────────────────────────────────────────────────────┐
│ 🌱 Nursery Link   Nurseries  Free seedlings  Tree library  News   Sign in│
├──────────────────────────────────────────┬─────────────────────────────┤
│                                          │ 🔍 Search tree or nursery    │
│              MAP (≈60%)                  │ District ▾   Sub-county ▾    │
│      (12)            ⬤ Seeta Fruit…      │ [◉ Sort by nearest] 📍on     │
│           ▲ Mukono Town (selected)       │ 15 nurseries · Mukono        │
│   ╔══ district boundary highlighted ══╗  │ ─────────────────────────── │
│   ║   🎁 Katosi Lakeshore             ║  │ 🎁 Katosi Lakeshore Seedl…   │
│   ╚═══════════════════════════════════╝  │   Ntenjeru · 4.2 km by road │
│  [+][−] [📍]            © OpenStreetMap  │   🌳🌾 · UGX 800–2,500       │
│                                          │ ⬤ Kasangalabi Tree Nursery   │
│                                          │   …                         │
└──────────────────────────────────────────┴─────────────────────────────┘
```
Selecting a pin or row opens the nursery card as a right-side drawer over the list panel. The map stays interactive.

**Nurseries `/nurseries`, mobile (375 px)**
```
┌─────────────────────────────────┐
│ ← 🔍 Search tree or nursery      │ floating search over map
│ [Map | List]            [📍]    │ segmented toggle
│                                 │
│         FULL-SCREEN MAP         │
│      (8)      🎁      ⬤          │
│                                 │
├─────────────────────────────────┤ ← draggable sheet (3 snap points:
│ ═══                             │   peek 20% / half / full)
│ District ▾  Sub-county ▾  ◉Near │
│ 15 nurseries                    │
│ 🎁 Katosi Lakeshore · 4.2 km     │
│ ⬤ Kasangalabi Tree · 6.0 km     │
└─────────────────────────────────┘
```

**Nursery card (desktop drawer / mobile full-height sheet)**
```
┌─────────────────────────────────┐
│ ✕                               │
│ Mukono Town Nursery             │ text-xl
│ Community nursery · ✔ Certified │ type + certification badge
│ 📍 4.2 km by road · Mukono Central│
│ 📞 +256 700 100 114  [Call]     │ tel: link, 44 px
│ Capacity 50,000 a year          │
│ Seed source: NTSC certified     │
│ Stocks: 🌳 🌾 🌸                 │ category icons with labels (sr)
│ 🕒 Stock updated 41 days ago     │ amber outlined badge if > 30 days
│ ─────────────────────────────── │
│ In stock                        │
│ Mvule ᵢ          1,200  UGX 1,500│ species name underlined →
│ Musizi ᵢ           800  UGX 1,200│ opens Library side drawer (FR-21)
│ Grevillea ᵢ      3,000    UGX 500│
│ ─────────────────────────────── │
│ [🧭 Get directions] [🛒 Order & deliver]│ sticky action row
└─────────────────────────────────┘
```
**Get directions** draws the route on the map and swaps the card body for a numbered step list, with a "Back to nursery" link.

**Checkout (steps within `/nurseries/:id/order`, mobile)**
```
┌─────────────────────────────────┐
│ ← Order from Mukono Town        │
│ ● Seedlings ─ ○ Delivery ─ ○ Pay │ 3-step progress
├─────────────────────────────────┤
│ Mvule         UGX 1,500 each     │
│ [−]  [ 200 ]  [+]   max 1,200   │ stepper, 44 px buttons, capped
│ Musizi        UGX 1,200 each     │
│ [−]  [   0 ]  [+]   max 800     │
├─────────────────────────────────┤
│ Delivery                        │
│ (●) Deliver to me  ( ) I'll collect│
│ ┌ mini map, pin from GPS ─────┐ │ drag pin to adjust
│ └─────────────────────────────┘ │
│ Address / landmark [__________] │ FR-25: required for delivery
├─────────────────────────────────┤
│ Your quote        expires 9:41  │ countdown; auto re-quote
│ 200 × Mvule            300,000   │
│ Delivery · 7.3 km by road 17,000│
│ Total              UGX 317,000   │
├─────────────────────────────────┤
│ Pay with  [MTN MoMo] [Airtel]   │ logo-free labelled tiles
│ Paying number [+256 ___ ___ ___]│
│ [ Pay UGX 317,000 ]             │ primary, full width
└─────────────────────────────────┘
→ "Check your phone and approve the payment" (live status, retry) → "Order placed"
```
On desktop the same steps sit in the right panel beside the map.

**Species page `/library/:slug`: the specimen sheet**
```
┌─────────────────────────────────────────────────────────┐
│ Tree library › Indigenous                               │
│ ┌───────────────┐  Mvule                  text-3xl sans │
│ │   photo       │  *Milicia excelsa*   serif italic     │
│ │  (specimen    │  Luganda: Muvule · Lugbara: …         │
│ │   plate)      │  🌳 Indigenous · Slow growing          │
│ └───────────────┘  [📍 Find nurseries near me]  (FR-20) │
│ ─ Growth over the years ─────────────────────────────── │
│  30 m ┤                                   ╭──── 🌳       │ SVG: height
│  15 m ┤                  ╭────────────────╯             │ over years,
│   5 m ┤      ╭───────────╯                              │ seedling →
│       └──┬───────┬────────┬─────────────┬──             │ tree glyphs
│         1 yr    5 yr    10 yr         30 yr             │
│ ─ Specimen ──────────────────────────────────────────── │
│   CANOPY ──→  ⌒⌒⌒ wide, spreading…  (labelled leader     │
│   TRUNK       │                       lines to a single │
│   ROOTS  ──→  ⋔ deep taproot, safe…   tree drawing)     │
│ ─ Where it grows ────────────────────────────────────── │
│   Lake Victoria crescent · Mid-altitude moist forest    │
└─────────────────────────────────────────────────────────┘
```
- **Paper:** the sheet sits on white with a thin Canopy frame, like a herbarium sheet.
- **Specimen block:** the canopy and root notes are laid out as a labelled specimen drawing with leader lines.
- **Mobile:** everything stacks into one column.

---

## Addendum: "Earth & canopy" redesign (October 2026)

Chosen by the product owner after the first build. It **replaces A1 (colour), A2 (typefaces) and the icon guidance in A5**; layout, formatting and copy rules stay.

- **Colour:** Uganda's green hills and red murram earth on warm cream.

  | Name | Hex | Role |
  |---|---|---|
  | Canopy | `#123D2A` | Headers, headings, dark bands |
  | Forest | `#1E5B3C` | Primary actions, links |
  | Banana leaf | `#2A7D45` | In stock, success |
  | Murram | `#B8501F` | Accents, the standout action on photos (light murram `#F0B48F` on dark green) |
  | Sun | `#F2B705` | Free seedlings only |
  | Cream | `#FAF6EE` | Page background |
  | Bark | `#2A211B` | Text |

- **Type:** Fraunces for headings and display text (warm, organic serif; italic for scientific names on Library pages). Atkinson Hyperlegible for body text, unchanged.
- **Imagery over icons:** real Ugandan photos lead Home and the section pages. Decorative icons are replaced by colour-coded text labels. Small functional icons (search, location, arrows) stay.
- **Ugandan cues:** mobile money and boda boda in the copy, local tree names as quick searches, and a woven-band footer motif after basketry and bark cloth.

