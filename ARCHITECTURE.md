# ARCHITECTURE.md — KDP Automation Platform

## 1. Monorepo layout

```
kdp-automation/            (repo root)
  apps/
    backend/               Express API (TypeScript)
    frontend/               React + Vite SPA (TypeScript)
  packages/
    shared/                 Cross-cutting types, zod schemas, API contracts
    config/                 Strongly typed env configuration (zod-validated)
    ai/                     AIProvider abstraction (Claude, OpenAI, Mock)
    storage/                 StorageProvider abstraction (Local, S3-compatible)
    document-engine/        Interior generation (PDF/EPUB/DOCX)
    cover-engine/            Cover generation, spine calculator
    kdp-validator/           Preflight / KDP compliance validation
  infrastructure/
    docker/                 Dockerfiles
    nginx/                  Reverse proxy config
  docs/                     API / DB / deployment docs
  scripts/                  One-off / migration scripts
```

Package manager: **npm workspaces** (matches the `npm run <x>` command
surface required by the brief; no pnpm/yarn). Root `package.json` declares
`workspaces: ["apps/*", "packages/*"]`.

Each package/app is an independent TS project with its own `tsconfig.json`
extending a shared root `tsconfig.base.json`. Cross-package imports use
package names (`@kdp/shared`, `@kdp/config`, etc.) resolved via npm
workspace symlinks — not relative `../../` paths across package
boundaries.

## 2. Backend architecture (`apps/backend`)

Layered, modular-by-feature. No business logic in routes or controllers.

```
src/
  server.ts              Process entrypoint: connect Mongo + Redis, listen
  app.ts                 Express app: middleware pipeline + route mounting
  common/
    errors/              AppError hierarchy, error codes, errorHandler middleware
    middleware/           asyncHandler, validateRequest(zod), requireAuth, requireRole, rateLimiter, requestId
    logger/                pino logger, redaction rules
    http/                  ApiResponse<T> envelope helpers
  db/
    mongoose.ts           connection bootstrap, index sync
  queue/
    redis.ts              ioredis connection factory
    queues.ts              BullMQ Queue instances per §27 (created Phase 4)
  modules/
    auth/                  User model, service, controller, routes, guards
    projects/               Project model, service, controller, routes
    dashboard/               aggregate-stats controller
    ... (one module per domain area, added per phase)
```

Each module owns: `*.model.ts` (Mongoose schema), `*.service.ts` (business
logic, DB access), `*.controller.ts` (thin — parse request, call service,
shape response), `*.routes.ts` (wiring + validation middleware),
`*.types.ts` (module-local types not shared with frontend), `*.test.ts`.

Controllers never touch `req`/`res` beyond their own file; services never
import Express types — this keeps services unit-testable without an HTTP
harness.

### 2.1 Request pipeline

`helmet` → `cors` (allowlist from config) → rate limiter → JSON body
parser (size-limited) → mongo-sanitize → `requestId` middleware → routes →
404 handler → centralized `errorHandler`.

### 2.2 Error contract

All thrown `AppError`s are caught by `errorHandler` and serialized as:

```json
{ "success": false, "error": { "code": "PROJECT_NOT_FOUND", "message": "...", "requestId": "..." } }
```

Unexpected errors are logged with full stack + requestId server-side and
returned to the client as a generic `INTERNAL_ERROR` (no stack leakage).

### 2.3 Auth

- Passwords hashed with `bcrypt` (cost 12).
- **Access token**: JWT, 15 min TTL, signed with `JWT_SECRET`, carried as
  `Authorization: Bearer <token>`. Payload: `{ sub: userId, role, sid: sessionId }`.
- **Refresh token**: opaque random 256-bit token, **not** a JWT. Stored
  server-side as a `Session` document, hashed (sha256) at rest, with
  `userId`, `expiresAt` (7d), `userAgent`, `ip`, `revokedAt`. Sent to the
  client as an `httpOnly`, `sameSite=lax`, `secure` (in prod) cookie
  (`rt`), never exposed to JS. This lets a session be revoked
  server-side (logout, "log out other devices", admin-forced logout) —
  a JWT refresh token could not be invalidated without a blocklist, which
  is exactly what the Session collection already is.
- Refresh rotates on every use (old session row is marked used/revoked,
  a new one issued) — mitigates replay of a stolen refresh cookie.
- `requireAuth` middleware verifies the access token and attaches
  `req.user = { id, role }`. `requireRole(...roles)` gates admin-only
  routes.

### 2.4 Multi-tenancy readiness (§48)

Every user-owned collection has a `userId` field now. An `organizationId`
(nullable) field is reserved on `Project` and `User` from the start so a
future org/team model doesn't require a migration — it's simply unused
(`null`) until Phase 11+ builds org management.

## 3. Frontend architecture (`apps/frontend`)

Vite + React 18 + TypeScript. Routing via `react-router-dom`. Server state
via `@tanstack/react-query` (no separate global store for server data).
Forms via `react-hook-form` + `zod` resolvers, sharing the same zod
schemas as the backend where practical (imported from `@kdp/shared`).

```
src/
  main.tsx, App.tsx
  routes/                  route tree, ProtectedRoute wrapper
  lib/
    api-client.ts           fetch wrapper: attaches access token, retries once on 401 via /auth/refresh, throws ApiError
    query-client.ts         React Query client config
  features/
    auth/                    LoginPage, RegisterPage, AuthProvider/useAuth
    dashboard/               DashboardPage, stat cards
    projects/                ProjectsListPage, ProjectCard, CreateProjectDialog
    ... (one per domain area, added per phase)
  components/
    layout/                  Sidebar, Topbar, AppShell
    ui/                      shadcn/ui primitives
  styles/                    Tailwind entry
```

Access token is kept in memory (React context), **not** localStorage, to
reduce XSS exfiltration surface; it's re-acquired via the httpOnly refresh
cookie on page load.

## 4. Data model (Phase 1 subset — extended per phase)

`User { _id, email, passwordHash, name, role: admin|user, organizationId?, createdAt, updatedAt }`

`Session { _id, userId, tokenHash, userAgent, ip, expiresAt, revokedAt? }`

`Project { _id, userId, organizationId?, name, bookType, niche, targetAudience, language, status, workflowStatus, createdAt, updatedAt, archivedAt? }`

Full model list for later phases is enumerated in §41 of the brief and
will be added incrementally as each phase lands (BookSpecification,
BookIdea, BookOutline, Chapter, Section, ContentVersion, Research,
Metadata, Asset, Cover, Template, PromptTemplate, AIUsage, Job,
ValidationResult, Export, SystemLog).

## 5. Assumptions (ambiguities resolved unilaterally)

- **JWT/session split**: brief asks for "access token, refresh token,
  session management" without specifying storage — resolved as above
  (§2.3). This is the standard production-grade pattern and is the most
  defensible default.
- **Node/TS build tooling**: `tsx` for dev (fast reload, no separate
  watch+compile step), `tsc` for production build, `vitest` for tests
  across all packages (one tool, ESM-native, fast).
- **Frontend AI actions in Phase 1**: none yet — AI provider work starts
  Phase 2. Phase 1 ships the shell + auth + projects only, per the
  brief's own phase ordering.
- **CSRF**: since the access token travels via `Authorization` header
  (not a cookie) and only the refresh cookie is `httpOnly`/`sameSite=lax`,
  classic CSRF (which relies on ambient cookie auth) has no attack
  surface. `sameSite=lax` is retained as defense in depth.
- **Rate limiting**: `express-rate-limit` backed by a Redis store
  (`rate-limit-redis`, dedicated connection separate from BullMQ's — see
  `common/middleware/rate-limit.ts`), so limits are enforced consistently
  across multiple backend instances rather than per-process.
- **Idea generation is synchronous, not a BullMQ job** (Phase 2): the brief's
  phase ordering puts "Book idea generation" in Phase 2 and BullMQ/job
  infrastructure in Phase 4. A handful of AI calls for idea generation
  completes well within a normal HTTP timeout, so it's a plain
  `async`/`await` service call for now; it should move onto the job queue
  once Phase 4 introduces one, for consistency with chapter/section
  generation (which genuinely needs to be a job).
- **PromptTemplate admin CRUD landed in Phase 11**: `PromptTemplate` is a
  real Mongoose-backed model with a seeded default (`BOOK_IDEA_GENERATOR`);
  the admin-only `GET /api/prompt-templates` shipped in Phase 2, and
  `POST`/`PATCH /:id` (plus an editor UI) were deliberately deferred until
  Phase 11, where the rest of the admin surface (users, book types,
  templates, validation rules, system info) was built together rather than
  piecemeal. There is still no hard-delete route — `PATCH` with
  `active: false` is the "remove without deleting" mechanism, reusing the
  field the Phase 2 model already had. Every edit bumps `version`.
- **The BullMQ worker runs in-process with the HTTP server** (Phase 4):
  `startContentGenerationWorker()` is called from the same `server.ts` that
  starts Express, not a separate process/container. The brief's Docker
  service list (§37) names `frontend`, `backend`, `mongodb`, `redis`,
  `nginx` — no separate `worker` service — so this matches the given
  infrastructure rather than inventing a new deployable. It's also the
  simplest thing that's still correct at this scale (`JOB_CONCURRENCY`
  bounds it). Splitting the worker into its own process/container is a
  legitimate scaling step later, but nothing about the job/queue design
  assumes in-process — `getContentGenerationQueue()`/`getRedisConnection()`
  work identically from a separate process.
- **BullMQ tests need a real Redis, unlike Mongo tests.** Mongo tests use
  `mongodb-memory-server` (no external dependency); BullMQ's Lua-script-
  heavy protocol isn't safely mockable the same way (`ioredis-mock` doesn't
  implement `EVAL` faithfully). Queue-dependent tests
  (`content-generation.integration.test.ts`) probe Redis reachability and
  `describe.skipIf` themselves out when it's unavailable, so `npm test`
  still passes without Redis running — full coverage requires
  `docker-compose.dev.yml` (or any reachable `REDIS_URL`) to be up. The
  dependency-free generation logic itself (`runContentGeneration`) has its
  own unit tests with no such requirement.
- **`packages/ai` structured output doesn't use the Anthropic SDK's
  `zodOutputFormat()` helper**: that helper's TypeScript types require zod
  v4 (`import * as z from 'zod/v4'` inside the SDK), while this monorepo
  standardizes on zod v3 everywhere else (shared DTOs, backend validation
  middleware, React Hook Form resolvers) — upgrading the whole repo to zod
  v4 for one helper wasn't worth the ripple. Instead, `ClaudeAIProvider`
  builds the JSON Schema itself via `zod-to-json-schema` and passes it as
  `output_config.format`, then validates the response with the caller's own
  zod v3 schema — same type safety, no v4 dependency. The OpenAI SDK's
  `zodResponseFormat()` helper is structurally typed (accepts either zod
  version) and is used as-is.
- **`packages/document-engine` uses one fixed 0.75" margin, not KDP's real
  page-count-dependent preflight rules** (Phase 7): KDP's actual margin/gutter
  and bleed requirements scale with a book's final page count, which isn't
  knowable until a manuscript is fully rendered — checking it is a validation
  concern, not a rendering one. Phase 7's renderers apply one conservative
  fixed margin so output is well-formatted and print-safe by construction;
  the page-count-dependent compliance check (verifying a given render
  actually satisfies KDP's rules for its specific page count) is Phase 9's
  job (the KDP validator). Phase 7's output should be read as "well-formatted"
  rather than "KDP-certified compliant" until Phase 9 lands. **Phase 9 closes
  this loop**: the PDF renderer now reports its actual rendered page count
  (`GeneratedInterior.pageCount`, plumbed through to the `Interior` model and
  `InteriorDto`), and a new `@kdp/kdp-validator` rule warns when a PDF
  interior exceeds 700 pages, per KDP's publicly documented margin guidance.
  That threshold is guidance to verify against KDP's current official
  specification, not an asserted pass/fail — the figures come from published
  formatting guidance, not a live compliance API.
- **`packages/cover-engine`'s spine-width calculation uses `BookSpecification`'s
  *estimated* page count, not any actually-generated interior's real page
  count** (Phase 8): generating a cover deliberately doesn't require an
  interior — or even an outline — to exist first, so the two generation flows
  stay independent, and a cover can be produced as soon as a specification
  exists. This means the spine width may be off until a real interior is
  rendered; regenerating the cover once a final page count is known is a
  lightweight, fast operation (no outline/content required), so the fix is a
  cheap re-run rather than a blocking dependency. Separately, AI
  image-generation calls made during cover generation are not recorded in
  `AIUsage` — that schema's cost model is token-based and doesn't fit
  per-image pricing, a documented scope limit for this phase.
- **`StorageProvider` gained a `read(key)` method** (Phase 10): every prior
  phase only ever wrote files and handed back a URL; Phase 10's export
  bundler is the first consumer that needs to read a *previously* generated
  file's actual bytes back out — to zip up an existing interior render and
  cover images without caring whether they live on local disk or S3 — so the
  interface grew a symmetric `read()` alongside its existing `write()`.
  Separately, Export deliberately does not automate any part of the actual
  KDP submission: no Amazon publishing API exists to integrate against, so
  the ZIP is a convenience bundle (interior + covers + a copy-paste-ready
  metadata summary) plus a README checklist for the human to follow
  manually, consistent with the brief's explicit prohibition on bypassing
  Amazon's real login/publish flow.
- **`disabled` accounts are only checked at login/refresh, not on every
  `requireAuth` call** (Phase 11): `requireAuth` deliberately stays a pure
  JWT-verify with no DB round-trip, for performance on the hot request path.
  The tradeoff is that an already-issued access token remains valid for its
  ~15-minute lifetime after an admin disables the account — acceptable
  because access tokens are already short-lived by design; a disabled
  account is locked out of starting a new session or rotating its refresh
  token within one token lifetime regardless.

## 6. Testing strategy

- **Unit**: services tested directly (no HTTP), AI/Storage/Research
  providers tested against their mock implementations.
- **Integration/API**: `supertest` against the Express `app` (not a
  listening server), backed by `mongodb-memory-server` (real Mongo
  semantics, no external dependency, works offline/CI).
- **Queue tests** (from Phase 4): BullMQ against a real Redis (docker) in
  CI, or `ioredis-mock` for fast local unit tests of job handlers in
  isolation.
- AI provider tests never call paid APIs — always the Mock provider.

## 7. Docker

`docker-compose.yml` at repo root brings up `mongo`, `redis`, `backend`,
`frontend` (built as static assets served by `nginx`), and an `nginx`
reverse proxy fronting both. Dev workflow uses `npm run dev` (concurrently
running backend + frontend with hot reload) against a docker-compose
that runs only `mongo` + `redis` (`docker-compose.dev.yml`).
