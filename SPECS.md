# dropthing — Ephemeral file sharing service

## Concept

Personal web service for ephemeral file sharing. Share files between your own devices or quickly share content with friends via a unique link.

Files have a configurable time-to-live (max 1 week) and are automatically deleted upon expiration.

## Core features

- **File upload**: photos, videos, text, any file type, max size 300 MB
- **Unique share link**: each upload generates a unique URL for downloading the file
- **Configurable TTL**: from a few hours up to 7 days, set at upload time
- **Automatic cleanup**: periodic job that purges expired files (file + metadata)
- **Streaming upload**: large file handling without loading into memory

## Future improvements

- Password protection
- Download count limit
- QR code for sharing links between devices
- On-the-fly image compression
- Drag & drop UI
- File preview (images, videos, text)

---

## Tech stack

### Runtime & language

| Tool           | Version | Notes                                                  |
| -------------- | ------- | ------------------------------------------------------ |
| **Bun**        | 1.3.9   | JavaScript runtime, package manager, native workspaces |
| **TypeScript** | 5.9.3   |                                                        |

### Backend

| Tool               | Version       | Role                                                                            |
| ------------------ | ------------- | ------------------------------------------------------------------------------- |
| **Effect**         | 4.0.0-beta.35 | Core business logic: typed errors, services, layers, schemas, scheduling        |
| **Hono**           | 4.12.8        | Web framework (ultralight, Bun first-class support, Web Standards)              |
| **Drizzle ORM**    | 1.0.0-beta.9  | Type-safe query builder with Effect integration (`drizzle-orm/effect-postgres`) |
| **@effect/sql-pg** | 4.0.0-beta.35 | Effect PgClient layer for PostgreSQL                                            |

### Database

| Tool              | Role                                                          |
| ----------------- | ------------------------------------------------------------- |
| **PostgreSQL 18** | Metadata storage (ID, expiration, MIME type, size, file path) |

### File storage

| Tool              | Role                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Cloudflare R2** | S3-compatible object storage, **no egress fees** (ideal for file sharing), 10 GB free |

Storage is abstracted behind a `StorageService` (Effect Layer) — can be swapped to S3, MinIO, or local filesystem without touching business logic.

### Frontend

| Tool             | Version       | Role                                                                                |
| ---------------- | ------------- | ----------------------------------------------------------------------------------- |
| **React**        | 19.x          | UI (familiarity choice — the goal is to learn Effect, not a new frontend framework) |
| **Vite**         | 6.x           | Build tool                                                                          |
| **shadcn/ui**    | latest        | Accessible, customizable UI components                                              |
| **Tailwind CSS** | 4.x           | Utility-first styling                                                               |
| **Effect**       | 4.0.0-beta.35 | HttpClient for API calls (no TanStack Query — Effect handles the HTTP layer)        |

### Linting & formatting

| Tool            | Version | Role                            |
| --------------- | ------- | ------------------------------- |
| **oxlint**      | 1.55.0  | Linter                          |
| **oxfmt**       | 0.40.0  | Formatter                       |
| **husky**       | 9.1.7   | Git hooks                       |
| **lint-staged** | 16.4.0  | Run lint/format on staged files |

Pre-commit hook runs `oxlint --fix` + `oxfmt --write` on staged files via lint-staged.

### Monorepo

| Tool               | Role                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------ |
| **Bun workspaces** | Monorepo management (simple `workspaces` field in root `package.json`, zero extra tooling) |

> Turborepo considered overkill for a solo project with 2-3 packages.

### Deployment

| Tool        | Role                                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| **Docker**  | One Dockerfile per app (multi-stage build with `oven/bun` image). API uses `oven/bun:1-slim` for runtime. |
| **Caddy**   | Serves the frontend static build (in the web Dockerfile)                                                  |
| **Coolify** | Self-hosted deployment platform, deploys via a single `docker-compose.prod.yml`                           |

Two separate domains:

- `dropthing.lukapps.fr` (web, Caddy static files on :8080)
- `api.dropthing.lukapps.fr` (API on :3001)

Traefik (managed by Coolify) routes traffic to each service. PostgreSQL is managed as a separate service by Coolify.

---

## Monorepo architecture

```
dropthing/
├── package.json                # workspaces: ["packages/*", "apps/*"]
├── tsconfig.json               # Base config + project references
├── .oxlintrc.json              # Shared oxlint config
├── .husky/pre-commit           # lint-staged hook
├── docker-compose.yml          # Local dev: PostgreSQL 18 on port 6543
├── docker-compose.prod.yml     # Production: api + web (portable, no Coolify dependency)
├── .env                        # Root env for docker-compose.prod.yml (DB_URL, R2_*, CORS_ORIGIN, VITE_API_URL)
├── apps/
│   ├── api/                    # Hono + Effect — backend API
│   │   ├── .env                # Local dev env (DB_URL)
│   │   ├── Dockerfile          # Multi-stage: oven/bun:1 (deps) → oven/bun:1-slim (runtime)
│   │   ├── tsconfig.json       # Extends root, composite: true
│   │   └── src/
│   │       ├── index.ts        # Hono app entrypoint, centralized layer composition
│   │       ├── helpers.ts      # Shared route helpers (withBasicErrorHandling)
│   │       ├── db/
│   │       │   └── schema.ts   # Drizzle table definitions (dropsTable)
│   │       ├── routes/
│   │       │   ├── health.ts   # GET /health
│   │       │   └── drop.ts     # GET /drops/:id (+ future POST, GET file)
│   │       └── services/
│   │           ├── db.ts       # DrizzleService (ServiceMap.Service), PgClientLive
│   │           └── drop.ts     # DropService (ServiceMap.Service)
│   └── web/                    # React + Vite + shadcn — frontend
│       ├── Dockerfile          # Multi-stage: oven/bun:1 (build) → caddy:2-alpine (serve)
│       ├── Caddyfile           # Static file server
│       ├── tsconfig.json       # Extends root, composite: true, jsx: react-jsx
│       └── src/
├── packages/
│   └── shared/                 # Effect schemas, types, errors
│       ├── tsconfig.json       # Extends root, composite: true
│       └── src/
│           ├── index.ts        # Re-exports schemas + errors
│           ├── schemas.ts      # Drop schema (Effect Schema)
│           └── errors.ts       # InvalidInputError (Schema.TaggedErrorClass)
```

---

## Effect services (backend)

### DropService

- `save(drop)` — insert drop metadata into PG
- `get(id)` — retrieve a drop by ID, decoded via `Schema.decodeUnknownEffect(Drop)`
- `listExpired()` — list all expired drops, decoded via `Schema.decodeUnknownEffect(Schema.Array(Drop))`
- `delete(id)` — delete a drop from PG
- Uses `DrizzleService` as a dependency (injected via Layer)

### StorageService (planned)

- `save(file, key)` — upload to R2
- `get(key)` — stream from R2
- `delete(key)` — delete from R2
- Abstracted behind a Layer, R2 today, swappable

### CleanupService (planned)

- Purges expired files (R2 file + PG metadata)
- Runs periodically via Effect `Schedule`

### UploadService (planned)

- Orchestrates the full flow: validation → storage → metadata → return share link
- Composes the other services

---

## Error handling

### Tagged errors (shared)

```typescript
// In @dropthing/shared/errors.ts — Effect v4 pattern
class InvalidInputError extends Schema.TaggedErrorClass("InvalidInputError")(
  "InvalidInputError",
  { message: Schema.String }
)
```

### Route error handling

Routes use `withBasicErrorHandling` helper that pipes errors through:

1. `catchTag("InvalidInputError")` → 400
2. `catchTag("SchemaError")` → 500
3. `Effect.catch` → 500

Input validation (e.g., UUID format) uses `Schema.decodeUnknownEffect` + `Effect.mapError` to transform `SchemaError` into `InvalidInputError`.

### Planned business errors

```typescript
type AppError =
  | FileTooLarge // file > 300 MB
  | UnsupportedMimeType // disallowed MIME type
  | DropNotFound // invalid or non-existent link
  | DropExpired // file has expired
  | StorageQuotaExceeded // R2 quota exceeded
  | InvalidTTL; // TTL out of bounds
```

---

## Main flows

### Upload

1. Validate parameters with `Schema` (size, type, TTL)
2. Stream file upload to R2 via `StorageService`
3. Save metadata in PG via `DropService`
4. Return unique download link

### Download

1. Look up metadata via `DropService`
2. Check expiration → `DropExpired` if past due
3. Stream file from R2 via `StorageService`

### Cleanup

1. Periodic job (`Schedule.spaced` or `Schedule.cron`)
2. List expired drops in PG via `DropService.listExpired()`
3. Delete files from R2
4. Delete metadata from PG

---

## Learning goals

This project is a hands-on exercise for learning **Effect v4**. Key concepts to practice:

- **Effect & pipe**: basic functional composition
- **Schema**: typed input validation + runtime decoding (`Schema.decodeUnknownEffect`)
- **Typed errors**: explicit error modeling with `Schema.TaggedErrorClass`, `catchTag`, `mapError`
- **ServiceMap.Service & Layer**: dependency injection (DrizzleService → DropService, centralized composition)
- **ManagedRuntime**: shared runtime for Hono handlers, single DB connection pool
- **Schedule**: periodic cleanup job
- **Stream**: streaming upload/download of large files
- **Effect.all**: concurrent operations (e.g. cleanup of multiple files)
