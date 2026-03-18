FROM oven/bun:1 AS deps
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

FROM oven/bun:1-slim AS runtime
WORKDIR /app
COPY --from=deps /app .
COPY . .
EXPOSE 3001
CMD ["sh", "-c", "echo \"DB_URL set: ${DB_URL:+yes}\" && cd apps/api && bunx drizzle-kit migrate && cd ../.. && bun run apps/api/src/index.ts"]
