# The API (Express + pg-boss workers). Built from the repository root so the pnpm workspace resolves.
FROM node:22-bookworm-slim AS build
# pnpm 11 needs Node 22 (it imports node:sqlite); the API code itself still targets Node 20
RUN npm install -g pnpm@11.22.0
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @nurserylink/api build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
# Uploaded photos (MEDIA_DIR=data/media) live here; mount a Railway volume at this path to keep them
RUN mkdir -p /app/apps/api/data/media
CMD ["sh", "/app/deploy/railway/start-api.sh"]
