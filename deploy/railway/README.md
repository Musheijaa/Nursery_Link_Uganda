# Hosting on Railway

One Railway project with four services. Only the two sites are public; the API and the database are
reached over Railway's private network.

| Service (exact name) | What it is | Built from | Public domain |
|---|---|---|---|
| `postgis` | PostgreSQL 16 + PostGIS 3.4 | Docker image `postgis/postgis:16-3.4` | no |
| `nurserylink-api` | REST API + background jobs | `deploy/railway/api.json` | no |
| `nurserylink-web` | Public site (Caddy) | `deploy/railway/web.json` | yes |
| `nurserylink-admin` | Admin console (Caddy) | `deploy/railway/admin.json` | yes |

Each site's Caddy server forwards `/api` and `/media` to the API, so the browser only ever talks to the
site's own address. That keeps the sign-in cookie first-party (`*.up.railway.app` is a public suffix,
so a direct cross-site call to the API would lose it). The names matter: the variables refer to each
other as `${{nurserylink-api.RAILWAY_PRIVATE_DOMAIN}}` and so on.

## Live

- Project **nursery-link-uganda** (EU West, Netherlands).
- Public site: https://nursery-link-uganda.up.railway.app
- Admin console: https://nursery-link-uganda-admin.up.railway.app
- The admin's password and the other generated secrets are kept only on the owner's computer, in
  `~/.nurserylink-railway-secrets.env`, never in the repository.

## How it was set up (Railway CLI, `railway login` first)

Railway no longer accepts `railway.json` as a service's config file, so `deploy/railway/{api,web,admin}.json`
hold the settings and `apply-settings.sh` applies them through the Railway API.

1. `railway init -n nursery-link-uganda`, then `railway add -s postgis -i postgis/postgis:16-3.4` with
   the `postgis` variables from `variables.sh`, a volume at `/var/lib/postgresql/data` (`volumeCreate`
   through `railway api`), and `railway service scale -s postgis eu-west=1`.
2. `railway add -s nurserylink-api` (and `-web`, `-admin`) as empty services, each scaled to `eu-west=1`.
3. `sh deploy/railway/apply-settings.sh`: Dockerfile path, health check, restart policy and watch paths.
4. `railway domain -s nurserylink-web -p 8080`, then `railway domain update <generated> --domain nursery-link-uganda`
   (and `nursery-link-uganda-admin` for the admin).
5. Variables: `variables.sh` prints them; set with `railway variable set -s <service> --skip-deploys KEY=VALUE …`.
6. `railway service source connect -s <service> --repo Musheijaa/Nursery_Link_Uganda --branch main` for the three
   app services, which starts the first deploy.
7. The sites read `API_UPSTREAM` when they start, and the API only gets its private address on its
   first deploy. So on a brand-new project, redeploy web and admin once the API is up:
   `railway service redeploy -s nurserylink-web -y` (and admin).
8. GitHub repository variables `PROD_WEB_URL` and `PROD_ADMIN_URL` (set) let the Production workflow
   check each deploy.

## Own domain (planned)

To drop `railway.app` from the address, buy a domain, then
`railway domain <your domain> -s nurserylink-web -p 8080` (and e.g. `admin.<your domain>` for the admin)
and add the DNS records it prints at the registrar. Then update the API's `PUBLIC_WEB_URL`, `CORS_ORIGINS`
and the GitHub `PROD_*` variables to the new addresses.

## Checking it

- `https://<web domain>/api/v1/health` shows `"status":"ok"`, `"db":"ok"`, the deployed `commit` and
  `"directions":"osrm-public"`.
- The admin console signs in with the `ADMIN_` details.

## Notes

- **Continuous delivery**: every push to `main` deploys (pull requests merge only after CI passes).
  `watchPatterns` in each config skip redeploys when only other parts of the repo change.
- **Photos uploaded in the admin** are stored in the API container (`/app/apps/api/data/media`). Attach a
  volume to `nurserylink-api` at that path to keep them across deploys.
- **Visitor IPs** (for rate limits): Caddy passes Railway's `X-Real-IP` on as `X-Forwarded-For`, and the
  API trusts one proxy (`TRUST_PROXY=1`).
- **Trial mode** is on (`PHONE_VERIFICATION=off`, `PAYMENTS=off`, mock providers) until SMS and mobile
  money are live.
- **Local check** of the images: `docker build -f deploy/railway/<api|web|admin>.Dockerfile .` from the
  repository root (CI builds all three on every pull request).
