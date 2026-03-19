# dropthing — Roadmap

Ordered by priority and Effect learning progression. Each phase introduces new Effect concepts incrementally.

---

## Phase 1 — Database & first Effect service ✓

**Goal**: Get data flowing through Effect, learn the Service/Layer pattern.

**New Effect concepts**: `Effect.gen`, `pipe`, `ServiceMap.Service`, `Layer`, `Layer.effect`, `Layer.provide`, `ManagedRuntime`, `@effect/sql-pg`

- [x] Drizzle schema: `drops` table (id, fileName, mimeType, size, storageKey, createdAt, expiresAt)
- [x] Drizzle Kit config + first migration
- [x] DrizzleService + PgClientLive layers via `ServiceMap.Service` (`services/db.ts`)
- [x] DropService: save, get, listExpired, delete (`services/drop.ts`)
- [x] Centralized layer composition in `index.ts` (PgClientLive → DrizzleService.layer → DropService.layer)
- [x] ManagedRuntime for sharing DB pool across Hono handlers
- [x] Runtime decoding with `Schema.decodeUnknownEffect(Drop)` — parse, don't validate
- [x] Route: `GET /drops/:id` with Effect-based error handling
- [x] Input validation: UUID check + `Effect.mapError` → `InvalidInputError`
- [x] Error handling helper: `withBasicErrorHandling` (catchTag chain)
- [x] Tagged error in shared: `InvalidInputError` via `Schema.TaggedErrorClass`
- [x] Migrated from Effect v3 to v4.0.0-beta.35
- [ ] Test with docker-compose PG: insert + retrieve a drop manually

---

## Phase 2 — Schema validation & typed errors

**Goal**: Validate inputs and model business errors explicitly.

**New Effect concepts**: `Schema` (deeper usage), `Schema.TaggedErrorClass` (more variants), typed Error channel

- [ ] Define shared schemas: `UploadParams` (in `@dropthing/shared`)
- [ ] Define typed errors: `FileTooLarge`, `InvalidTTL`, `DropNotFound`, `DropExpired`
- [ ] Validate upload params through `Schema.decodeUnknown`

> Note: Some Phase 2 concepts were already introduced in Phase 1 (Schema.decodeUnknown, InvalidInputError, catchTag). This phase goes deeper with business-specific errors.

---

## Phase 3 — Storage & upload flow

**Goal**: Compose multiple services, stream files.

**New Effect concepts**: `Stream`, service composition, Layer swapping

- [ ] StorageService interface: save, get, delete
- [ ] LocalStorageLayer (filesystem) for dev — simplest implementation to start
- [ ] UploadService: validate → store file → save metadata → return share link
- [ ] API routes: `POST /drops`, wired to UploadService via ManagedRuntime
- [ ] R2StorageLayer — swap in Cloudflare R2 without touching business logic

---

## Phase 4 — Download flow

**Goal**: Complete the core loop (upload → share → download).

**New Effect concepts**: error matching/recovery (`Effect.catchTag` — deeper usage)

- [ ] API route: `GET /drops/:id/file` — stream file from storage
- [ ] Handle `DropNotFound` and `DropExpired` with proper HTTP responses
- [ ] Frontend: download page at `/drops/:id` (fetch metadata, display info, download button)

---

## Phase 5 — Frontend upload UI

**Goal**: Functional upload page.

**New Effect concepts**: Effect `HttpClient` in the browser (already set up)

- [ ] Upload form: file picker, TTL selector
- [ ] Upload via Effect HttpClient → `POST /drops`
- [ ] Display share link after successful upload
- [ ] Copy-to-clipboard

---

## Phase 6 — Automatic cleanup

**Goal**: Periodic background job, concurrent operations.

**New Effect concepts**: `Schedule`, `Effect.all` with concurrency

- [ ] CleanupService: list expired → delete from storage + metadata
- [ ] Schedule the cleanup job (`Schedule.spaced` or `Schedule.cron`)
- [ ] Run as part of the API process (no separate worker needed)

---

## Phase 7 — Polish & nice-to-haves

Pick from:

- [ ] Drag & drop upload
- [ ] File preview (images, videos, text)
- [ ] QR code generation for share links
- [ ] Password-protected shares
- [ ] Download count limit
- [ ] On-the-fly image compression
