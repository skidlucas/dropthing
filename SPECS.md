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

| Tool | Version | Notes |
|------|---------|-------|
| **Bun** | 1.3.9+ | JavaScript runtime, package manager, native workspaces |
| **TypeScript** | 5.x (Bun compat) | |

### Backend

| Tool | Version | Role |
|------|---------|------|
| **Effect** | 4.0.0-beta.31 | Core business logic: typed errors, services, layers, schemas, scheduling |
| **Hono** | 4.x | Web framework (ultralight, Bun first-class support, Web Standards) |
| **Drizzle ORM** | 1.0.0-beta.9 | Type-safe query builder with Effect integration (`drizzle-orm/effect-postgres`) |
| **@effect/sql-pg** | 4.0.0-beta.31 | Native Effect layer for PostgreSQL |

### Database

| Tool | Role |
|------|------|
| **PostgreSQL 18** | Metadata storage (ID, expiration, MIME type, size, file path) |

> In Effect v4, `@effect/sql-pg` is part of the unified package system and shares the same version number as the `effect` package.

### File storage

| Tool | Role |
|------|------|
| **Cloudflare R2** | S3-compatible object storage, **no egress fees** (ideal for file sharing), 10 GB free |

Storage is abstracted behind a `StorageService` (Effect Layer) — can be swapped to S3, MinIO, or local filesystem without touching business logic.

### Frontend

| Tool | Version | Role |
|------|---------|------|
| **React** | 19.x | UI (familiarity choice — the goal is to learn Effect, not a new frontend framework) |
| **Vite** | 6.x | Build tool |
| **shadcn/ui** | latest | Accessible, customizable UI components |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **Effect** | 4.0.0-beta.31 | HttpClient for API calls (no TanStack Query — Effect handles the HTTP layer) |

### Linting & formatting

| Tool | Role |
|------|------|
| **oxlint** | Linter |
| **oxfmt** | Formatter |

### Monorepo

| Tool | Role |
|------|------|
| **Bun workspaces** | Monorepo management (simple `workspaces` field in root `package.json`, zero extra tooling) |

> Turborepo considered overkill for a solo project with 2-3 packages.

### Deployment

| Tool | Role |
|------|------|
| **Docker** | One Dockerfile per app (multi-stage build with `oven/bun` image). API uses `oven/bun:1-slim` for runtime. |
| **Caddy** | Serves the frontend static build + reverse proxies `/api` to the API service (in the web Dockerfile) |
| **Coolify** | Self-hosted deployment platform, deploys via a single `docker-compose.prod.yml` |

Architecture: `Traefik (Coolify) → web (Caddy :8080) → static files + /api/* → api:3000`

Two domains: `dropthing.lukapps.fr` (web) and `api.dropthing.lukapps.fr` (API).

PostgreSQL is managed as a separate service by Coolify.

---

## Monorepo architecture

```
dropthing/
├── package.json                # workspaces: ["packages/*", "apps/*"]
├── docker-compose.yml          # Local dev: PostgreSQL 18
├── docker-compose.prod.yml     # Production: api + web (portable, no Coolify dependency)
├── .env                        # Environment variables (DB_URL, R2_*, CORS_ORIGIN, VITE_API_URL)
├── apps/
│   ├── api/                    # Hono + Effect — backend API
│   │   ├── Dockerfile          # Multi-stage: oven/bun:1 (deps) → oven/bun:1-slim (runtime)
│   │   └── src/
│   │       ├── index.ts        # Hono app entrypoint
│   │       └── services/       # Effect service stubs
│   │           ├── storage.ts
│   │           ├── metadata.ts
│   │           ├── cleanup.ts
│   │           └── upload.ts
│   └── web/                    # React + Vite + shadcn — frontend
│       ├── Dockerfile          # Multi-stage: oven/bun:1 (build) → caddy:2-alpine (serve)
│       ├── Caddyfile           # Static file server
│       └── src/
├── packages/
│   └── shared/                 # Effect schemas, types, constants
│                               # Imported as @dropthing/shared
```

---

## Effect services (backend)

### StorageService
- `save(file, key)` — upload to R2
- `get(key)` — stream from R2
- `delete(key)` — delete from R2
- Abstracted behind a Layer, R2 today, swappable

### MetadataService
- PostgreSQL CRUD: register a share, retrieve info, list active shares
- Uses `@effect/sql-pg` + Drizzle ORM to stay within the Effect ecosystem

### CleanupService
- Purges expired files (R2 file + PG metadata)
- Runs periodically via Effect `Schedule`

### UploadService
- Orchestrates the full flow: validation → storage → metadata → return share link
- Composes the other services

---

## Typed error modeling

```typescript
// Expected business errors (Effect Error channel)
type AppError =
  | FileTooLarge         // file > 300 MB
  | UnsupportedMimeType  // disallowed MIME type (if restricted)
  | ShareNotFound        // invalid or non-existent link
  | ShareExpired         // file has expired
  | StorageQuotaExceeded // R2 quota exceeded
  | InvalidTTL           // TTL out of bounds
```

---

## Main flows

### Upload
1. Validate parameters with `Schema` (size, type, TTL)
2. Stream file upload to R2 via `StorageService`
3. Save metadata in PG via `MetadataService`
4. Return unique download link

### Download
1. Look up metadata via `MetadataService`
2. Check expiration → `ShareExpired` if past due
3. Stream file from R2 via `StorageService`

### Cleanup
1. Periodic job (`Schedule.spaced` or `Schedule.cron`)
2. List expired shares in PG
3. Delete files from R2
4. Delete metadata from PG

---

## Learning goals

This project is a hands-on exercise for learning **Effect (v4 beta)**. Key concepts to practice:

- **Effect & pipe**: basic functional composition
- **Schema**: typed input validation (upload params, TTL, etc.)
- **Typed errors**: explicit error modeling in the Error channel
- **Service & Layer**: dependency injection (StorageService, MetadataService, etc.)
- **Schedule**: periodic cleanup job
- **Stream**: streaming upload/download of large files
- **Effect.all**: concurrent operations (e.g. cleanup of multiple files)
