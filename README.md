# Nursery Link Uganda

A Web-GIS marketplace and supply-gap analytics platform for Uganda's tree nursery sector.

Nursery Link Uganda replaces the paper logbooks and scattered spreadsheets currently used to track tree nurseries with a single coordinate-accurate platform. Buyers, restoration planners, and carbon-project developers can browse a map of certified nurseries, check seedling stock, and place delivery orders secured by mobile money escrow. The "Nursery Shadow" view overlays nursery service zones against forest-loss hotspots to flag underserved, heavily deforested areas — surfacing where new nurseries or funding are needed most. The platform also hosts a directory of free seedling campaigns from government, NGO, and corporate funders, and a Digital Tree Library for species reference.

> **Project status:** frontend prototype. All data (nurseries, species, campaigns, orders, forest-loss hotspots) is seeded in `src/data/` and held in memory, so changes reset on page reload. Payments, escrow, and authentication are simulated in the browser; no backend or real Mobile Money integration exists yet.

## Features

- **Find seedlings:** search by tree and planting district; nurseries are sorted by road distance and shown on an OpenStreetMap map with an optional forest-loss layer
- **Checkout per nursery:** collect, boda boda or truck delivery priced by distance and load, Ugandan phone validation, and MTN MoMo / Airtel Money approval on the buyer's phone
- **Held payments:** money is released to the nursery only when the buyer confirms delivery or gives the rider their 4-digit delivery code
- **Tree guide:** 14 native and introduced species with local names, regions, altitude, uses and planting tips
- **Planting calendar:** good planting months for each region of Uganda
- **Free seedling programmes:** eligibility, applications and voucher codes for collection at partner nurseries
- **Planting gaps:** district supply vs. estimated demand, forest-loss areas, and CSV export
- **Nursery owner tools:** handle orders (prepare → dispatch → confirm with the buyer's code), edit stock and prices, add batches

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
public/images/            # Photos from Wikimedia Commons, resized for low bandwidth (credited in-app)
src/
├── App.tsx               # Layout and page switching
├── context/AppContext.tsx # State and actions: cart, orders, stock, vouchers
├── types/index.ts        # Domain models
├── data/                 # Sample nurseries, species, districts, programmes, forest data, image credits
├── utils/                # Formatting, distance and delivery pricing, phone validation
└── components/
    ├── ui.tsx            # Shared buttons, badges, fields, modal, photo
    ├── layout/           # Header, footer, logo
    ├── home/             # Home page
    ├── seedlings/        # Search, map and nursery detail
    ├── cart/             # Cart and checkout
    ├── trees/            # Tree guide
    ├── programmes/       # Free seedling programmes
    ├── gaps/             # Planting gaps analysis
    ├── orders/           # Buyer order tracking
    ├── nursery/          # Nursery owner tools
    └── credits/          # Photo credits
```

## Sample data

Nurseries, people, phone numbers, programmes and sponsors are fictional. Forest-loss and demand figures are illustrative. Tree information and planting seasons are general guidance and should be checked with local extension officers.

## Roadmap

- Backend API (Node.js/Express) with PostgreSQL + PostGIS for nurseries, inventory, and orders
- Server-side escrow and real MTN MoMo / Airtel Money collection and disbursement
- Authentication with separate buyer and nursery-manager roles
- Road-network service zones and Global Forest Change data in place of seeded hotspots
- Coverage beyond the Mukono District pilot
