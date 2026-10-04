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

## First setup

1. **New project** → **Empty project**. In project **Settings**, pick the region closest to Uganda
   (EU West, Amsterdam).
2. **Database**: **+ New → Docker Image** → `postgis/postgis:16-3.4`. Rename the service to `postgis`.
   Right-click it → **Attach volume**, mount path `/var/lib/postgresql/data`.
3. **API, web and admin**: three times, **+ New → GitHub Repo** → `Musheijaa/Nursery_Link_Uganda`.
   For each one:
   - **Settings → Service name**: `nurserylink-api`, `nurserylink-web` or `nurserylink-admin`.
   - **Settings → Config-as-code → Railway config file**: `/deploy/railway/api.json`, `web.json` or
     `admin.json`. (This is what fixes Railpack's "No start command detected".)
   - **Settings → Source**: branch `main`, and switch on **Wait for CI**.
4. **Domains**: on `nurserylink-web` and `nurserylink-admin`, **Settings → Networking → Generate Domain**
   (port 8080). Leave the API and the database without one.
5. **Variables**: on your computer, run

   ```sh
   sh deploy/railway/variables.sh https://<web domain> https://<admin domain>
   ```

   and paste each block into that service's **Variables → Raw Editor**. Fill in the four `ADMIN_` lines
   first (the administrator the seed creates; password of 12+ characters).
6. **Deploy**: Railway asks to deploy the staged changes; accept. The database starts, the API runs its
   migrations and loads the seed (nurseries, trees, campaigns, boundaries, the admin), then both sites
   come up. The first API start takes a few minutes.
7. **GitHub**: repository **Settings → Secrets and variables → Actions → Variables**: add `PROD_WEB_URL`
   and `PROD_ADMIN_URL` (the two domains). The **Production** workflow then confirms each deploy.

## Checking it

- `https://<web domain>/api/v1/health` shows `"status":"ok"`, `"db":"ok"`, the deployed `commit` and
  `"directions":"osrm-public"`.
- The admin console signs in with the `ADMIN_` details.

## Notes

- **Continuous delivery**: merges to `main` deploy automatically once CI passes ("Wait for CI").
  `watchPatterns` in each config skip redeploys when only other parts of the repo change.
- **Photos uploaded in the admin** are stored in the API container (`/app/apps/api/data/media`). Attach a
  volume to `nurserylink-api` at that path to keep them across deploys.
- **Visitor IPs** (for rate limits): Caddy passes Railway's `X-Real-IP` on as `X-Forwarded-For`, and the
  API trusts one proxy (`TRUST_PROXY=1`).
- **Trial mode** is on (`PHONE_VERIFICATION=off`, `PAYMENTS=off`, mock providers) until SMS and mobile
  money are live.
- **Local check** of the images: `docker build -f deploy/railway/<api|web|admin>.Dockerfile .` from the
  repository root (CI builds all three on every pull request).
