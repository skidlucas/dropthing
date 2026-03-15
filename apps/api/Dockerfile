FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN bun install --frozen-lockfile

FROM base AS runtime
COPY --from=deps /app .
COPY . .
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
