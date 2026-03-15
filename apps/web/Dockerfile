FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

# Build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
RUN cd apps/web && bun run build

# Serve with lightweight static server
FROM oven/bun:1-slim AS runtime
WORKDIR /app
COPY --from=build /app/apps/web/dist ./dist

# Simple static file server
RUN echo 'Bun.serve({ port: 8080, fetch(req) { return new Response(Bun.file("dist" + new URL(req.url).pathname)) } })' > server.ts
EXPOSE 8080
CMD ["bun", "run", "server.ts"]
