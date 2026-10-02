# Nursery Link Uganda

A Web-GIS marketplace and supply-gap platform for Uganda's tree nursery sector, piloted in Mukono District. Buyers find nurseries on a map, compare stock and prices, and order seedlings with mobile-money escrow. Free-seedling campaigns are listed with eligibility checks, and a Digital Tree Library describes each species. The "Nursery Shadow" analysis shows administrators heavily deforested areas that lie outside every nursery's 20 km road-network service zone.

Requirements and design: [`docs/`](docs/) (SRS and SDD). Engineering decisions and conventions: [`CLAUDE.md`](CLAUDE.md).

## Repository layout

```
apps/api/          Express + TypeScript REST API (/api/v1)
apps/web/          Public React site (being reconnected to the new API)
packages/shared/   Zod schemas, enums and types shared by the API and frontends
scripts/osrm/      Road-network preparation for OSRM
scripts/mtn/       MTN MoMo sandbox API-user setup
scripts/forest-loss/  Hansen forest-loss loader for the Nursery Shadow (Python + GDAL)
docs/              SRS and SDD
```

## Requirements

- Node.js 20+ and pnpm 11 (`corepack enable`)
- Docker (for PostGIS, OSRM and the test suite's Testcontainers)

## Getting started

```bash
cp .env.example .env              # then fill in the secrets (see comments in the file)
docker compose up -d db           # PostGIS 16 + 3.4 on 127.0.0.1:5433
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                          # API on http://localhost:4000, web on http://localhost:5173
curl http://localhost:4000/api/v1/health
```

All external services default to mocks (`PAYMENT_PROVIDER_MODE=mock`, `SMS_PROVIDER=mock`, `ROUTING_PROVIDER=mock`, `EMAIL_PROVIDER=mock`), so the API runs without any accounts.

**API reference:** <http://localhost:4000/api/v1/docs> (Swagger UI). The raw OpenAPI 3.1 document is at `/api/v1/docs/openapi.json`. Request schemas come from the same Zod schemas the routes validate with, and a test fails if a route is added without being documented.

**Mock payments in development:** after placing an order, approve (or decline) the mobile-money prompt with `POST /api/v1/dev/mock-payments/settle {"order_id": "…", "status": "successful"}`. This route exists only with mock payments outside production.

### MTN Mobile Money sandbox (optional)

1. Register at <https://momodeveloper.mtn.com> and subscribe to the **Collections** and **Disbursements** products. Each gives you a subscription key.
2. Create a sandbox API user and key for each product, and paste the printed lines into `.env`:
   ```bash
   scripts/mtn/sandbox-user.sh collection   <collections subscription key>
   scripts/mtn/sandbox-user.sh disbursement <disbursements subscription key>
   ```
3. Set `PAYMENT_PROVIDER_MODE=live`. Leave `MTN_TARGET_ENVIRONMENT=sandbox` and `MTN_CURRENCY=EUR`, because the sandbox accepts only EUR (amounts are still whole shillings).
4. Optional: set `MTN_CALLBACK_URL` to a public URL that reaches `/api/v1/webhooks/payments/mtn_momo`, for example through a tunnel. Without it, payments are confirmed by polling 20 s, 1 min and 3 min after the prompt.

To check your credentials against the real sandbox, run `MTN_SANDBOX_TEST=1 pnpm --filter @nurserylink/api exec vitest run src/providers/payment/mtnMomo.test.ts` with the `MTN_*` variables exported.

Airtel Money is not integrated yet. In live mode it is refused before an order is created, and payouts to Airtel numbers are flagged for an admin.

### Road routing with OSRM (optional)

```bash
scripts/osrm/prepare.sh                     # downloads the Uganda extract from Geofabrik and preprocesses it
docker compose --profile routing up -d osrm
# then set ROUTING_PROVIDER=osrm in .env
```

### Forest-loss data for the Nursery Shadow (optional)

The Nursery Shadow analysis needs Hansen Global Forest Change data loaded into `forest_loss_cells`. See [`scripts/forest-loss/README.md`](scripts/forest-loss/README.md) for downloading the tiles and running the loader, which works without a local Python install via the GDAL Docker image. Without the data, shadow runs still succeed but find nothing, and the API says so in `meta.warnings`.

## Production checklist

- **Secrets:** generate fresh `JWT_ACCESS_SECRET`, `QUOTE_TOKEN_SECRET` and `OTP_HMAC_SECRET` (`openssl rand -hex 32`). Never reuse development values.
- **Environment:** `NODE_ENV=production`, which enables `Secure` cookies and hides the mock-payment route. Set `CORS_ORIGINS` to exactly the web and admin origins, and `PUBLIC_WEB_URL` to the public site.
- **Proxies:** set `TRUST_PROXY` to the number of reverse proxies (usually `1` behind nginx or a load balancer). Otherwise every client shares one rate-limit bucket.
- **Providers:**
  - Payments: `PAYMENT_PROVIDER_MODE=live` with MTN production credentials, `MTN_TARGET_ENVIRONMENT=mtnuganda`, `MTN_CURRENCY=UGX` and `MTN_CALLBACK_URL`.
  - SMS: `SMS_PROVIDER=africastalking` with `SMS_INBOUND_TOKEN`.
  - Email: `EMAIL_PROVIDER=smtp`.
  - Routing: `ROUTING_PROVIDER=osrm`.

  The API logs a warning at startup for any provider still on a mock.
- **Run as one instance.** In-memory rate limits are per process. The per-number SMS limits are in the database.
- **Build and start:** `pnpm build`, then `node apps/api/dist/db/migrate.js` and `node apps/api/dist/db/seed/index.js` (both are safe on every deploy), then `node apps/api/dist/server.js`. Terminate TLS at the proxy.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test        # starts a throwaway PostGIS container; Docker must be running
```

Map data © OpenStreetMap contributors. Photo credits are listed in the web app.
