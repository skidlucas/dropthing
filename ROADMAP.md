# dropthing — Roadmap

Ordered by priority and Effect learning progression. Each phase introduces new Effect concepts incrementally.

---

## Phase 1 — Database & first Effect service ✓

**Goal**: Get data flowing through Effect, learn the Service/Layer pattern.

**New Effect concepts**: `Effect.gen`, `pipe`, `ServiceMap.Service`, `Layer`, `Layer.effect`, `Layer.provide`, `ManagedRuntime`

- [x] Drizzle schema: `drops` table (id, type, content, fileName, mimeType, size, storageKey, createdAt, expiresAt)
- [x] Drizzle Kit config + migrations
- [x] DrizzleService layer via `ServiceMap.Service` (`db/db.service.ts`)
- [x] DropRepository: insert, findById, findExpired, deleteById (`modules/drop/drop.repository.ts`)
- [x] DropService: create, get, delete, listExpired (`modules/drop/drop.service.ts`)
- [x] Layered architecture: Route → DropService (business logic) → DropRepository (data access) → DrizzleService
- [x] Centralized layer composition in `index.ts` (DrizzleService → DropRepository → DropService)
- [x] ManagedRuntime for sharing DB pool across Hono handlers
- [x] Runtime decoding with `Schema.decodeUnknownEffect(Drop)` — parse, don't validate
- [x] Routes: `POST /drops`, `GET /drops/:id`, `DELETE /drops/:id`
- [x] Input validation: UUID check + `Effect.mapError` → `InvalidInputError`
- [x] Error handling helper: `withBasicErrorHandling` (`catchTags`)
- [x] Tagged errors: `InvalidInputError`, `FileTooLargeError`, `DatabaseError`
- [x] Migrated from Effect v3 to v4.0.0-beta.35
- [x] `query()` wrapper: bridges drizzle promises into Effect with `DatabaseError`
- [x] `Effect.fn` for call-site tracing on all service/repository methods

---

## Phase 2 — Schema validation & multi-type drops ✓

**Goal**: Validate inputs, model business errors, support 3 drop types.

**New Effect concepts**: `Schema.NumberFromString`, `Schema.isBetween`, `Schema.TaggedErrorClass`, `Schema.Literals`, `Schema.NullOr`, `Schema.URLFromString`, `Effect.tryPromise`

- [x] 3 drop types: file, text (code snippets), link — discriminated via `type` column (default: `text`)
- [x] `UploadParams` schema with `NumberFromString` + `isBetween` validation
- [x] `DropType` union via `Schema.Literals(['file', 'text', 'link'])`
- [x] `CreateDropInput` as discriminated union (`{ type: 'file'; file: File } | { type: 'text'; content: string } | ...`)
- [x] `FileTooLargeError` tagged error with `maxSize`/`actualSize`
- [x] Upload flow: multipart formData → validate → save file / validate URL → insert DB → return drop
- [x] Constraints: `MAX_FILE_SIZE` (100MB), `MIN_TTL` (60s), `MAX_TTL` (7 days)
- [x] Text drops preserve formatting (stored as-is in `content` column)
- [x] Link drops validated via `Schema.URLFromString`
- [ ] Define typed errors: `DropNotFound`, `DropExpired` (deferred to Phase 4)

---

## Phase 3 — Storage service & Layer swapping ✓

**Goal**: Extract storage into a service, swap implementations.

**New Effect concepts**: Layer swapping, `Effect.try` vs `Effect.tryPromise`, service composition, env-based layer selection

- [x] StorageService interface: `save`, `get`, `delete` — contract pur sans implémentation
- [x] `StorageError` tagged error in `@dropthing/shared`
- [x] `LocalStorageLayer` (filesystem) — `Bun.write`/`Bun.file`/`unlink`
- [x] `R2StorageLayer` — Cloudflare R2 via Bun's built-in `S3Client`
- [x] DropService refactored to depend on `StorageService` (not inline storage)
- [x] DropService.delete now cleans up storage files
- [x] Env-based layer selection: `USE_R2=true` (default) → R2, `USE_R2=false` → local
- [x] Layer composition: `DrizzleService → DropRepository ─┐ StorageLayer ─┼→ DropService`

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

- [ ] Upload form: file picker, text editor, link input, TTL selector
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
