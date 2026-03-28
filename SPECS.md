# dropthing — Ephemeral file sharing service

## Concept

Personal web service for ephemeral file sharing. Share files, text snippets, or links between your own devices or quickly share content with friends via a unique link.

Drops have a configurable time-to-live (max 1 week) and are automatically deleted upon expiration.

## Core features

- **3 drop types**:
  - **File**: photos, videos, any file type, max 100 MB
  - **Text**: code snippets, notes — CodeMirror 6 editor with syntax highlighting
  - **Link**: URL sharing — auto-detected from text content (no separate tab)
- **Unique share link**: each drop generates a unique URL
- **Configurable TTL**: from 1 minute up to 7 days, set at upload time
- **Automatic cleanup**: periodic job that purges expired drops (file + metadata)
- **AI metadata** (planned): language detection + title generation via Groq

## Future improvements

- Password protection
- Download count limit
- QR code for sharing links between devices
- On-the-fly image compression
- File preview (images, videos, text)
- Streaming upload for large files

---

## Tech stack

### Runtime & language

| Tool           | Version | Notes                                                  |
| -------------- | ------- | ------------------------------------------------------ |
| **Bun**        | 1.3.9   | JavaScript runtime, package manager, native workspaces |
| **TypeScript** | 6.0.2   |                                                        |

### Backend

| Tool            | Version       | Role                                                                     |
| --------------- | ------------- | ------------------------------------------------------------------------ |
| **Effect**      | 4.0.0-beta.35 | Core business logic: typed errors, services, layers, schemas, scheduling |
| **Hono**        | 4.12.8        | Web framework (ultralight, Bun first-class support, Web Standards)       |
| **Drizzle ORM** | 1.0.0-beta.9  | Type-safe query builder via `drizzle-orm/node-postgres`                  |
| **pg**          | latest        | PostgreSQL driver (promise-based, wrapped with `query()` into Effect)    |

### Database

| Tool              | Role                                                                    |
| ----------------- | ----------------------------------------------------------------------- |
| **PostgreSQL 18** | Metadata storage (ID, type, content, expiration, MIME type, size, path) |

### File storage

| Tool              | Role                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------- |
| **Cloudflare R2** | S3-compatible object storage, **no egress fees** (ideal for file sharing), 10 GB free |
| **Bun S3Client**  | Built-in S3-compatible client in Bun (no `@aws-sdk/client-s3` needed)                 |

Storage is abstracted behind a `StorageService` (Effect Layer). Two implementations available:
- `LocalStorageLayer` — filesystem (`./uploads/`), used in dev (`USE_R2=false`)
- `R2StorageLayer` — Cloudflare R2 via Bun's `S3Client`, used in prod (default)

### Frontend

| Tool                          | Version | Role                                                                                |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------- |
| **React**                     | 19.x    | UI (familiarity choice — the goal is to learn Effect, not a new frontend framework) |
| **Vite**                      | 6.x     | Build tool                                                                          |
| **Tailwind CSS**              | 4.x     | Utility-first styling                                                               |
| **CodeMirror 6**              | 4.25.9  | Code editor (via `@uiw/react-codemirror`) with Tokyo Night theme                   |
| **@codemirror/language-data** | 6.5.2   | Lazy-loaded language grammars for syntax highlighting                               |

### AI (planned)

| Tool     | Role                                                            |
| -------- | --------------------------------------------------------------- |
| **Groq** | Fast LLM inference (LPU) — language detection + title generation |

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
│   │   ├── .env                # Local dev env (DB_URL, USE_R2, R2_*)
│   │   ├── Dockerfile          # Multi-stage: oven/bun:1 (deps) → oven/bun:1-slim (runtime)
│   │   ├── drizzle.config.ts   # Drizzle Kit config
│   │   ├── tsconfig.json       # Extends root, composite: true
│   │   └── src/
│   │       ├── index.ts        # Hono app entrypoint, centralized layer composition
│   │       ├── common/
│   │       │   └── helpers.ts  # Shared route helpers (withBasicErrorHandling)
│   │       ├── db/
│   │       │   ├── db.service.ts  # DrizzleService, DatabaseError, query() wrapper
│   │       │   └── schema.ts     # Drizzle table definitions (dropsTable)
│   │       └── modules/
│   │           ├── drop/
│   │           │   ├── drop.route.ts       # POST /drops, GET /drops/:id, GET /drops/:id/file, DELETE /drops/:id
│   │           │   ├── drop.service.ts     # Business logic (validation, storage, URL check)
│   │           │   └── drop.repository.ts  # Data access (insert, findById, findExpired, deleteById)
│   │           ├── storage/
│   │           │   ├── storage.service.ts     # StorageService interface + StorageError
│   │           │   ├── localStorage.layer.ts  # Local filesystem implementation
│   │           │   └── r2Storage.layer.ts     # Cloudflare R2 implementation (Bun S3Client)
│   │           └── health/
│   │               └── health.route.ts     # GET /health
│   └── web/                    # React + Vite — frontend
│       ├── Dockerfile          # Multi-stage: oven/bun:1 (build) → caddy:2-alpine (serve)
│       ├── Caddyfile           # Static file server
│       ├── tsconfig.json       # Extends root, composite: true, jsx: react-jsx
│       └── src/
│           ├── App.tsx         # URL-based routing (/ → UploadPage, /drops/:id → DropPage)
│           ├── lib/
│           │   └── api.ts      # API client (createDrop, getDrop, getFileUrl, isUrl, helpers)
│           ├── components/
│           │   └── code-editor.tsx  # CodeMirror 6 wrapper (Tokyo Night, lazy language loading)
│           └── pages/
│               ├── UploadPage.tsx   # File drop zone + CodeMirror editor + TTL selector
│               └── DropPage.tsx     # View/download page (file, text, link)
├── packages/
│   └── shared/                 # Effect schemas, types, errors, constants
│       ├── tsconfig.json       # Extends root, composite: true
│       └── src/
│           ├── index.ts        # Re-exports schemas + errors + constants
│           ├── schemas.ts      # Drop, DropType, UploadParams, UUID
│           ├── errors.ts       # InvalidInputError, FileTooLargeError, StorageError
│           └── constants.ts    # MAX_FILE_SIZE, MIN_TTL, MAX_TTL
```

---

## Backend architecture

### Layered architecture

```
Route (HTTP)            → parse FormData/params, construct CreateDropInput
DropService (métier)    → validation, storage delegation, expiresAt, URL check
DropRepository (data)   → CRUD via drizzle, Schema decoding
StorageService (infra)  → save/get/delete files (LocalStorage or R2)
DrizzleService (infra)  → drizzle instance with node-postgres driver
AiService (infra)       → Groq API for metadata generation (planned)
```

Layer composition in `index.ts`:
```
DrizzleService → DropRepository ─┐
StorageLayer ───────────────────┼→ DropService
AiService (planned) ────────────┘
```

`StorageLayer` is selected at startup based on `USE_R2` env var.

### DropRepository

- `insert(input)` — insert drop metadata into PG, return decoded Drop
- `findById(id)` — retrieve a drop by ID, decoded via `Schema.decodeUnknownEffect(Drop)`
- `findExpired()` — list all expired drops
- `deleteById(id)` — delete a drop from PG

### DropService

- `create(input)` — validate input, save file via StorageService (if file type), validate URL (if link type), compute expiresAt, delegate to repository. (Planned: enrich with AI metadata)
- `get(id)` — find drop, yield `DropNotFoundError` if missing, yield `DropExpiredError` if expired
- `getFile(id)` — calls `get`, validates it's a file drop, returns `{ drop, content }` from StorageService
- `delete(id)` — bypasses expiration (uses `repo.findById`), deletes storage file + DB record
- `listExpired()` — delegate to repository
- `CreateDropInput`: discriminated union (`{ type: 'file'; file: File } | { type: 'text'; content: string } | { type: 'link'; content: string }`)

### StorageService

- `save(key, data: Blob)` — save file to storage (key format: `YYYY/MM/DD/uuid.ext`)
- `get(key)` — read file as `Uint8Array`
- `delete(key)` — delete file from storage
- Interface only (no `static layer`) — implementations are separate files
- Two implementations: `LocalStorageLayer` (filesystem), `R2StorageLayer` (Cloudflare R2 via Bun S3Client)

### AiService (planned)

- Wraps Groq API for fast LLM inference
- `enrichDrop(content, type)` → `{ language?: string, title: string }`
- Called during `DropService.create()` for all drop types
- Graceful degradation: if Groq call fails, drop is created without metadata

### CleanupService (planned)

- Purges expired drops (storage file + PG metadata)
- Runs periodically via Effect `Schedule`

---

## Frontend architecture

### Routing

Simple URL-based routing in `App.tsx` (no react-router):
- `/` → `UploadPage`
- `/drops/:id` → `DropPage`

### UploadPage

- **2 tabs**: File | Text
- **File tab**: drag & drop zone with `<button>` element (a11y), file picker fallback
- **Text tab**: CodeMirror 6 editor (Tokyo Night theme) + language selector dropdown
- **Auto-detect URL**: if text content is a single valid HTTP(S) URL → sent as `type: 'link'` transparently, with "Link detected" indicator
- **TTL selector**: 5 min / 1 hour / 1 day / 7 days
- **After upload**: shows share link + copy-to-clipboard + "Drop another" reset

### DropPage

- **File drops**: file name, size, expiry time, download button (`max-w-md`)
- **Text drops**: CodeMirror 6 read-only viewer, copy button (`max-w-2xl` for code readability). Language highlighting planned via AI-detected `metadata.language`
- **Link drops**: clickable URL, open + copy buttons (`max-w-md`)
- **Error states**: 404 / 410 / generic error with back-to-home link

### CodeEditor component

Shared wrapper around `@uiw/react-codemirror`:
- Tokyo Night theme
- Lazy-loaded language grammars via `@codemirror/language-data`
- Configurable: `readOnly`, `language`, `placeholder`, `minHeight`, `maxHeight`
- Handles `exactOptionalPropertyTypes` via conditional spread

---

## Data model

### drops table

| Column      | Type            | Notes                                          |
| ----------- | --------------- | ---------------------------------------------- |
| `id`        | UUID PK         | `gen_random_uuid()`                            |
| `type`      | VARCHAR         | `'file' \| 'text' \| 'link'`, default `'text'` |
| `content`   | TEXT nullable   | Text/link content                              |
| `fileName`  | VARCHAR nullable| Original file name                             |
| `mimeType`  | VARCHAR nullable| MIME type for files                            |
| `size`      | INTEGER nullable| File size in bytes                             |
| `storageKey`| VARCHAR nullable| R2/local path (`YYYY/MM/DD/uuid.ext`)          |
| `metadata`  | JSONB nullable  | (planned) AI-generated: `{ language?, title }` |
| `createdAt` | TIMESTAMP       | `now()`                                        |
| `expiresAt` | TIMESTAMP       | `createdAt + TTL`                              |

### metadata JSONB (planned)

Polymorphic per drop type, no fixed schema enforced at DB level (validated by Effect Schema in app).

```jsonb
-- text drop with code
{ "language": "TypeScript", "title": "Express auth middleware" }

-- text drop with plain text
{ "title": "Shopping list for Saturday" }

-- link drop
{ "title": "Tailwind CSS documentation" }

-- file drop
{ "title": "Screenshot of the bug" }
```

---

## Drop types

| Type   | Required fields     | Validation                          | Storage              |
| ------ | ------------------- | ----------------------------------- | -------------------- |
| `file` | `file` (File)       | Size ≤ 100 MB                       | StorageService (R2 or local) |
| `text` | `content` (string)  | Non-empty                           | DB `content` column  |
| `link` | `content` (string)  | Valid URL (`Schema.URLFromString`)   | DB `content` column  |

Default type: `text`. Link type is auto-detected from text content on the frontend.

## Error handling

### Tagged errors (shared)

```typescript
// In @dropthing/shared/errors.ts — Effect v4 pattern
class InvalidInputError extends Schema.TaggedErrorClass("InvalidInputError")(
  "InvalidInputError",
  { message: Schema.String }
)

class FileTooLargeError extends Schema.TaggedErrorClass("FileTooLargeError")(
  "FileTooLargeError",
  { message: Schema.String, maxSize: Schema.Number, actualSize: Schema.Number }
)
```

### Route error handling

Routes use `withBasicErrorHandling` helper that pipes errors through `catchTags`:

| Error              | HTTP Status |
| ------------------ | ----------- |
| `InvalidInputError`| 400         |
| `FileTooLargeError`| 413         |
| `DropNotFoundError`| 404         |
| `DropExpiredError`  | 410         |
| `SchemaError`      | 500         |
| `DatabaseError`    | 500         |
| `StorageError`     | 500         |
| fallback           | 500         |

Input validation (e.g., UUID format) uses `Schema.decodeUnknownEffect` + `Effect.mapError` to transform `SchemaError` into `InvalidInputError`.

### Domain errors

- `DropNotFoundError` — drop does not exist (404)
- `DropExpiredError` — drop has expired, includes `expiredAt` date (410)

---

## Main flows

### Upload (POST /drops)

1. Parse `FormData`: extract `type`, `expiresIn` via `UploadParams` schema
2. Extract `file` or `content` from FormData (route)
3. DropService validates (file size / URL format)
4. Save file via StorageService if file type
5. (Planned) Call AiService to generate metadata (language, title)
6. Insert metadata in PG via DropRepository
7. Return drop as JSON (201)

### Download (GET /drops/:id/file)

1. Validate UUID, call `DropService.getFile(id)`
2. Service checks not-found → `DropNotFoundError` (404)
3. Service checks expiration → `DropExpiredError` (410)
4. Service checks it's a file drop → `InvalidInputError` (400)
5. Fetch content from StorageService
6. Return `Response` with `Content-Type`, `Content-Disposition: attachment`, `Content-Length`

### Cleanup (planned)

1. Periodic job (`Schedule.spaced` or `Schedule.cron`)
2. List expired drops via `DropService.listExpired()`
3. Delete files from storage
4. Delete metadata from PG

---

## Learning goals

This project is a hands-on exercise for learning **Effect v4**. Key concepts to practice:

- **Effect & pipe**: basic functional composition
- **Schema**: typed input validation + runtime decoding (`Schema.decodeUnknownEffect`)
- **Typed errors**: explicit error modeling with `Schema.TaggedErrorClass`, `catchTags`, `mapError`
- **ServiceMap.Service & Layer**: dependency injection (DrizzleService → DropRepository → DropService), Layer swapping (LocalStorage ↔ R2)
- **ManagedRuntime**: shared runtime for Hono handlers, single DB connection pool
- **Layer swapping**: same interface, multiple implementations, env-based selection at startup
- **Schedule**: periodic cleanup job
- **Stream**: streaming upload/download of large files
- **Effect.all**: concurrent operations (e.g. cleanup of multiple files)
- **Effect.fn**: call-site tracing on service/repository methods
