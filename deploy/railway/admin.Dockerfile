# The admin site: a static Vite build served by Caddy, which also forwards /api and /media to the API
# over Railway's private network, so the browser sees one origin (see Caddyfile.admin).
FROM node:22-bookworm-slim AS build
RUN npm install -g pnpm@11.22.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# Production mode only for the build (during install it would skip the devDependencies Vite needs)
RUN NODE_ENV=production pnpm --filter @nurserylink/admin build

FROM caddy:2-alpine
COPY --from=build /app/apps/admin/dist /srv
COPY deploy/railway/Caddyfile.admin /etc/caddy/Caddyfile
