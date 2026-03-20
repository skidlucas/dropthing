# dropthing — Roadmap

Ordered by priority and Effect learning progression. Each phase introduces new Effect concepts incrementally.

---

## Phase 1 — Database & first Effect service ✓

**Goal**: Get data flowing through Effect, learn the Service/Layer pattern.

**New Effect concepts**: `Effect.gen`, `pipe`, `ServiceMap.Service`, `Layer`, `Layer.effect`, `Layer.provide`, `ManagedRuntime`

- [x] Drizzle schema: `drops` table (id, fileName, mimeType, size, storageKey, createdAt, expiresAt)
- [x] Drizzle Kit config + first migration
- [x] DrizzleService layer via `ServiceMap.Service` (`services/db.ts`)
- [x] DropService: create, get, listExpired, delete (`services/drop.ts`)
- [x] Centralized layer composition in `index.ts` (DrizzleService.layer → DropService.layer)
- [x] ManagedRuntime for sharing DB pool across Hono handlers
- [x] Runtime decoding with `Schema.decodeUnknownEffect(Drop)` — parse, don't validate
- [x] Routes: `GET /drops/:id`, `POST /drops`, `DELETE /drops/:id`
- [x] Input validation: UUID check + `Effect.mapError` → `InvalidInputError`
- [x] Error handling helper: `withBasicErrorHandling` (`catchTags`)
- [x] Tagged errors: `InvalidInputError`, `FileTooLargeError`, `DatabaseError`
- [x] Migrated from Effect v3 to v4.0.0-beta.35
- [x] `query()` wrapper: bridges drizzle promises into Effect with `DatabaseError`
- [x] `Effect.fn` for call-site tracing on all service methods

---

## Phase 2 — Schema validation & typed errors ✓

**Goal**: Validate inputs and model business errors explicitly.

**New Effect concepts**: `Schema.NumberFromString`, `Schema.isBetween`, `Schema.TaggedErrorClass` (more variants), `Effect.tryPromise`

- [x] `UploadParams` schema with `NumberFromString` + `isBetween` validation
- [x] `FileTooLargeError` tagged error with `maxSize`/`actualSize`
- [x] Upload flow: multipart formData → validate → save file → insert DB → return drop
- [x] Constraints: `MAX_FILE_SIZE` (100MB), `MIN_TTL` (60s), `MAX_TTL` (7 days)
- [ ] Define typed errors: `DropNotFound`, `DropExpired` (deferred to Phase 4)

---

## Phase 3 — Storage service & Layer swapping

**Goal**: Extract storage into a service, swap implementations.

**New Effect concepts**: `Stream`, service composition, Layer swapping

- [x] Local file storage in `uploads/` (inline in route, temporary)
- [ ] StorageService interface: save, get, delete
- [ ] LocalStorageLayer (filesystem) — extract from current route logic
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
