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
- [x] Env-based layer selection: `USE_R2=true` → R2, `USE_R2=false` → local
- [x] Date-based storage keys: `year/month/day/uuid.ext` (zero-padded for lexicographic sort)
- [x] Layer composition: `DrizzleService → DropRepository ─┐ StorageLayer ─┼→ DropService`

---

## Phase 4 — Download flow & typed domain errors ✓

**Goal**: Complete the core loop (upload → share → download), typed error handling.

**New Effect concepts**: domain errors with `Schema.TaggedErrorClass`, `return yield*` for type narrowing, `catchTags` for centralized HTTP error mapping, transitive error propagation through service composition

- [x] `DropNotFoundError` and `DropExpiredError` tagged errors in `@dropthing/shared`
- [x] `DropService.get` refactored: returns `Drop` (not `Drop | null`), yields typed errors
- [x] `DropService.getFile` — fetches drop + file content from StorageService
- [x] `DropService.delete` — bypasses expiration check (uses `repo.findById` directly)
- [x] API route: `GET /drops/:id/file` — download with `Content-Type`, `Content-Disposition`, `Content-Length`
- [x] `withBasicErrorHandling` updated: `DropNotFoundError` → 404, `DropExpiredError` → 410
- [x] Routes simplified: no more manual `if (!drop)` checks — errors handled by `catchTags`

---

## Phase 5 — Frontend ✓

**Goal**: Functional upload & view pages with code editor.

- [x] Upload form: file drop zone (drag & drop), CodeMirror 6 text editor, TTL selector
- [x] 2 tabs: File | Text (link auto-detected from text content)
- [x] CodeMirror 6 with Tokyo Night theme, language selector, lazy-loaded grammars
- [x] Auto-detect URLs in text content → sent as `type: 'link'` transparently
- [x] Display share link after successful upload + copy-to-clipboard
- [x] Drop view page: CodeMirror read-only for text, download button for files, clickable link for URLs
- [x] Simple URL-based routing (no react-router — 2 pages only)
- [x] Responsive container: `max-w-md` for file/link drops, `max-w-2xl` for text drops

---

## Phase 6 — AI-powered metadata (Groq)

**Goal**: Enrich drops with AI-generated metadata at creation time.

**New Effect concepts**: external API integration via `Effect.tryPromise`, JSONB metadata column, service composition with optional/fallback behavior

- [ ] Add `metadata` JSONB column to `drops` table (nullable) — polymorphic per drop type
- [ ] `AiService` Effect service wrapping Groq API (fast LLM inference)
- [ ] Detect programming language for text drops (replaces heuristic-based detection)
- [ ] Auto-generate short title for all drop types
- [ ] Called in `DropService.create()` — single Groq call returns `{ language, title }`
- [ ] Frontend: display `metadata.language` for syntax highlighting, `metadata.title` instead of generic label
- [ ] Graceful degradation: if Groq fails, drop is created without metadata (no blocking)

---

## Phase 7 — Automatic cleanup

**Goal**: Periodic background job, concurrent operations.

**New Effect concepts**: `Schedule`, `Effect.all` with concurrency

- [ ] CleanupService: list expired → delete from storage + metadata
- [ ] Schedule the cleanup job (`Schedule.spaced` or `Schedule.cron`)
- [ ] Run as part of the API process (no separate worker needed)

---

## Phase 8 — Polish & nice-to-haves

Pick from:

- [ ] File preview (images, videos, text)
- [ ] QR code generation for share links
- [ ] Password-protected shares
- [ ] Download count limit
- [ ] On-the-fly image compression
