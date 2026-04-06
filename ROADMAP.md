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
- [x] DropService: create, get, delete (`modules/drop/drop.service.ts`)
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
- [x] Constraints: `MAX_FILE_SIZE` (3GB), `MIN_TTL` (60s), `MAX_TTL` (7 days)
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

- [x] Upload form: file drop zone (drag & drop), CodeMirror 6 text editor, TTL pill selector
- [x] Mode selector: File | Text with sliding pill animation (motion translateX)
- [x] CodeMirror 6 with custom dark theme (#0a0a0a bg), integrated language picker (Base UI Select overlay), lazy-loaded grammars
- [x] Auto-detect URLs in text content → sent as `type: 'link'` transparently
- [x] Display share link after successful upload + copy-to-clipboard (sonner toast)
- [x] Drop view page: CodeMirror read-only for text, download button for files, clickable link for URLs
- [x] Simple URL-based routing (no react-router — 2 pages only)
- [x] Responsive container: `max-w-md` for file/link drops, `max-w-2xl` for text drops
- [x] Custom hooks: `useDrop`, `useFilePreview`, `useUploadDrop`, `useCopyFeedback` — reduced useState/useEffect sprawl
- [x] TanStack Query for data fetching (`useQuery` + `useMutation`, `staleTime: Infinity`)
- [x] Motion animations: fade transitions, animated checkmark, spring interactions
- [x] Sonner toasts for copy feedback

---

## Phase 6 — AI-powered metadata (Groq) ✓

**Goal**: Enrich drops with AI-generated metadata at creation time.

**New Effect concepts**: external API integration via `Effect.tryPromise`, JSONB metadata column, service composition with optional/fallback behavior, `Effect.catch` for graceful degradation

- [x] Added `metadata` JSONB column to `drops` table (nullable) — polymorphic per drop type
- [x] `AiService` Effect service wrapping Groq API via `@ai-sdk/groq` (Vercel AI SDK)
- [x] Model: `llama-3.3-70b-versatile` with JSON prompt (no structured outputs — model doesn't support `json_schema`)
- [x] Detect programming language for text drops (replaces heuristic-based detection)
- [x] Auto-generate descriptive title for text/link drops (file drops excluded — filename alone isn't useful context)
- [x] Called in `DropService.create()` — single Groq call returns `{ language?, title }`
- [x] Frontend: `metadata.language` drives CodeMirror syntax highlighting, `metadata.title` shown as heading on DropPage + success screen on UploadPage
- [x] Graceful degradation: `Effect.catch(() => Effect.succeed(null))` — if Groq fails, drop is created without metadata
- [x] `DropMetadata` schema with `Schema.optionalKey` for optional fields
- [x] `DropJson` wire type: `Omit<Drop, dates> & { dates: string }` for JSON serialization

---

## Phase 7 — Automatic cleanup ✓

**Goal**: Periodic background job, concurrent operations.

**New Effect concepts**: `Schedule.spaced`, `Effect.repeat`, `Effect.all` with `concurrency`, `Effect.catch` for fault-tolerant scheduling, `Layer.mergeAll`, `runtime.runFork`

- [x] `CleanupService`: list expired drops with storage keys → delete files from storage → clear `storageKey` in DB (soft delete — row kept for 410 UX)
- [x] `findExpiredWithStorageKey()` repo method — only targets drops that still have files to clean
- [x] `clearStorageKey(id)` repo method — sets `storageKey = null` after file deletion
- [x] `Effect.all` with `{ concurrency: 5, discard: true }` for parallel file cleanup
- [x] Scheduled via `Effect.repeat(Schedule.spaced("5 minutes"))` with `Effect.catch` per iteration (errors don't break the schedule)
- [x] Forked as background fiber via `runtime.runFork` in `index.ts`
- [x] Job definition isolated in `cleanup.job.ts`, separate from service logic
- [x] `Layer.mergeAll(DropService.layer, CleanupService.layer)` for horizontal layer composition

---

## Phase 8 — End-to-end encryption + testing ✓

**Goal**: Opt-in client-side encryption so the server never sees plaintext. Prove it with tests.

**New Effect concepts**: `Schema.check(Schema.makeFilter(...))` for cross-field validation, `@effect/vitest` with `it.effect()`/`it.live()`, `Layer.succeed` for test doubles, `Effect.provide` for dependency injection in tests

**New concepts**: Web Crypto API (`AES-256-GCM`), URL fragment (`#`) for key transport, `ArrayBuffer` ↔ base64 encoding, Blob URLs for decrypted previews

- [x] `crypto.ts` client-side module: `generateKey`, `encrypt`/`decrypt` (AES-256-GCM), `exportKey`/`importKey` (base64url), `encryptText`/`decryptText`, `packFile`/`unpackFile`
- [x] IV (12 bytes) prepended to ciphertext — single `ArrayBuffer` for storage
- [x] `packFile`/`unpackFile`: packs original filename into encrypted payload (2-byte length prefix + UTF-8 name + content), so the server never sees the real filename
- [x] `encrypted` boolean column in DB + `Drop` schema + `CreateDropInput` + `UploadParams`
- [x] `UploadParams` schema: `encrypted` field via `Schema.optionalKey(Schema.Literal('true'))`
- [x] Server-side: skip AI enrichment and URL validation when `encrypted` flag is set
- [x] Any drop type can be encrypted (file, text, link)
- [x] Upload flow: toggle → generate key → encrypt content/file client-side → upload ciphertext → key in URL fragment (`#`)
- [x] Encrypted file uploads sanitized: sent as `encrypted.bin` / `application/octet-stream` (no filename/MIME metadata leakage)
- [x] View flow (text): extract key from `window.location.hash` → base64 → ArrayBuffer → decrypt → display
- [x] View flow (file): fetch ciphertext → decrypt → `unpackFile` recovers original filename → Blob download
- [x] Missing key UX: clear error message when fragment is absent
- [x] Test infrastructure: vitest + `@effect/vitest` for Effect-native testing
- [x] Crypto unit tests (14): round-trips, IV uniqueness, wrong key, tampered ciphertext, packFile/unpackFile
- [x] Service invariant tests (5): encrypted drops skip AI, encrypted links skip URL validation, non-encrypted drops call AI. Uses `Layer.succeed` mock layers + `it.effect()`
- [x] Integration tests (2): real DB queries proving zero-knowledge (stored content != plaintext). Uses `it.live()` with real Postgres

---

## Phase 9 — Polish & nice-to-haves

Pick from:

- [x] File preview (images, videos, audio) — works with E2EE via decrypted Blob URLs
- [x] UI/UX polish: motion animations, Base UI components, custom CodeMirror theme, sonner toasts
- [x] Streaming downloads — `StorageService.getStream()` → `Stream<Uint8Array>` → `Stream.toReadableStream()` → HTTP Response. RAM serveur fixe (~chunk size) au lieu de buffer complet
- [x] File size limit raised to 3 GB (`MAX_FILE_SIZE`)
- [ ] Password-protected shares
- [ ] Download count limit
- [ ] On-the-fly image compression
- [ ] Streaming uploads (bypass `formData()`, multipart parsing from raw stream — required if concurrent large uploads on constrained server)
