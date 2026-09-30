# Nursery Link Uganda

A Web-GIS marketplace and supply-gap analytics platform for Uganda's tree nursery sector.

Nursery Link Uganda replaces the paper logbooks and scattered spreadsheets currently used to track tree nurseries with a single coordinate-accurate platform. Buyers, restoration planners, and carbon-project developers can browse a map of certified nurseries, check seedling stock, and place delivery orders secured by mobile money escrow. The "Nursery Shadow" view overlays nursery service zones against forest-loss hotspots to flag underserved, heavily deforested areas — surfacing where new nurseries or funding are needed most. The platform also hosts a directory of free seedling campaigns from government, NGO, and corporate funders, and a Digital Tree Library for species reference.

> **Project status:** frontend prototype. All data (nurseries, species, campaigns, orders, forest-loss hotspots) is seeded in `src/data/` and held in memory, so changes reset on page reload. Payments, escrow, and authentication are simulated in the browser; no backend or real Mobile Money integration exists yet.

## Features

- **Nursery map:** Leaflet map with filtering by district, species, category, and certification, adjustable service-zone radius (5/10/20 km), and a deforestation hotspot layer
- **Order & delivery checkout:** multi-step cart → delivery details → Mobile Money authorisation, with distance-based delivery pricing and an escrow release PIN
- **Order tracking:** escrow status per order, released to the nursery once the buyer confirms delivery with their PIN
- **Nursery manager dashboard:** live seedling batches, held-escrow total, and registration of new batches
- **Nursery Shadow analytics:** hotspot list, sub-county opportunity index, and CSV report export
- **Free seedling campaigns:** campaign directory, grant applications, and voucher issuance
- **Digital Tree Library:** searchable species registry that links through to nurseries stocking each species

## Tech stack

- [React 18](https://react.dev) + TypeScript, bundled with [Vite](https://vitejs.dev)
- [Tailwind CSS 3](https://tailwindcss.com) for styling
- [Leaflet](https://leafletjs.com) via [react-leaflet](https://react-leaflet.js.org) with CARTO Voyager basemap tiles
- [lucide-react](https://lucide.dev) icons, [canvas-confetti](https://github.com/catdad/canvas-confetti) for success feedback

## Getting started

Requires Node.js 18 or later.

```bash
npm install
npm run dev       # start the dev server at http://localhost:5173
npm run build     # type-check and build for production into dist/
npm run preview   # serve the production build locally
```

## Project structure

```
src/
├── App.tsx               # Top-level layout; switches views on the active tab
├── context/AppContext.tsx # Application state and actions (cart, orders, escrow, inventory, vouchers)
├── types/index.ts        # Domain models
├── data/                 # Seed data: nurseries, tree species, campaigns, forest-loss analytics
└── components/
    ├── LandingPage.tsx
    ├── Navbar.tsx, Footer.tsx, Sidebar.tsx
    ├── map/              # Nursery map and nursery detail / add-to-cart modal
    ├── checkout/         # Mobile Money escrow checkout
    ├── orders/           # Order tracking and escrow release
    ├── dashboard/        # Nursery manager inventory dashboard
    ├── shadow/           # Nursery Shadow supply-gap analytics
    ├── campaigns/        # Free seedling campaigns and vouchers
    └── library/          # Digital Tree Library
```

## Roadmap

- Backend API (Node.js/Express) with PostgreSQL + PostGIS for nurseries, inventory, and orders
- Server-side escrow and real MTN MoMo / Airtel Money collection and disbursement
- Authentication with separate buyer and nursery-manager roles
- Road-network service zones and Global Forest Change data in place of seeded hotspots
- Coverage beyond the Mukono District pilot
