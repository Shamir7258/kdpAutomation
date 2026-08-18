# TODO.md — active work

See PLAN.md for phase-level roadmap. This file tracks granular in-flight tasks.

## Phase 0 — Foundation
- [x] Root workspace `package.json`, `tsconfig.base.json`, `.gitignore`, `.editorconfig`
- [x] `packages/config` — env schema + loader
- [x] `packages/shared` — enums, DTOs, API envelope types
- [x] `apps/backend` skeleton — app.ts, server.ts, error handling, logger, db bootstrap
- [x] `apps/frontend` skeleton — Vite + React + TS + Tailwind + shadcn/ui base
- [x] Docker: Dockerfiles (backend, frontend), docker-compose.yml, docker-compose.dev.yml, nginx conf
- [x] `.env.example` (root, backend, frontend as needed)
- [x] Root scripts: dev, build, test, lint, format, docker:up, docker:down, migrate

## Phase 1 — Auth, Projects, Dashboard
- [x] `User` + `Session` Mongoose models
- [x] Auth service (register, login, refresh rotation, logout, RBAC guard)
- [x] Auth routes + zod validation
- [x] `Project` model + service (CRUD, duplicate, archive/restore, search/filter/sort)
- [x] Project routes
- [x] Dashboard aggregate-stats route
- [x] Backend tests: auth (register/login/refresh/logout/RBAC), projects (CRUD + ownership), dashboard
- [x] Frontend: api-client with refresh-on-401, AuthProvider, ProtectedRoute
- [x] Frontend: Login/Register pages
- [x] Frontend: AppShell (sidebar nav per §4), Dashboard page with stat cards
- [x] Frontend: Projects list page (table/cards, search/filter/sort, create dialog)
- [x] Manual dev-server walkthrough (Playwright-driven browser session: register→dashboard→create/rename/duplicate/archive/restore project→sign out→sign back in, zero console errors). Caught and fixed a real bug: `z.coerce.boolean()` coerced the query-string literal `"false"` to `true`, leaking archived projects into the default project list. Fixed in `packages/shared/src/project.schemas.ts`, covered by a new regression test.
- [x] `docs/API.md` — Phase 1 endpoints
- [x] `docs/DATABASE.md` — Phase 1 models
- [x] `docs/DEPLOYMENT.md` — local + Docker deployment

## Phase 2 — Book types, Book specification, Idea generation
- [x] `packages/ai` — AIProvider interface + Mock + Claude + OpenAI implementations, pricing table, tests
- [x] `PromptTemplate` model + seed + admin-only list route (full CRUD UI is Phase 11)
- [x] `BookType` shared catalog + backend runtime registry
- [x] Book idea generation endpoint (sync, not job — see ARCHITECTURE.md §5)
- [x] `BookSpecification` model + create/get endpoints
- [x] `AIUsage` tracking wired into dashboard's AI usage card
- [x] Backend tests for all of the above (mocked AI provider)
- [x] Frontend Book Generator panel + live Playwright verification
- [x] `docs/API.md` / `docs/DATABASE.md` updated for Phase 2 endpoints/models

## Phase 3 — Research, Outline
- [x] `ResearchProvider` abstraction + `AIResearchProvider` implementation
- [x] Research generate/list/latest endpoints + frontend panel
- [x] `Chapter`/`Section` models + full outline CRUD (generate, add/rename/delete/reorder chapter & section, regenerate chapter/section)
- [x] Drag-and-drop outline UI (native HTML5 DnD)
- [x] Backend tests (research + outline, mocked AI provider) — 12 new tests, 45 total passing
- [x] Frontend Book Generator page renamed conceptually to the project-detail workflow; sidebar's standalone "Research"/"Book Generator" nav items removed since both live inside a project now
- [x] Live Playwright verification of the full research → ideas → spec → outline flow
- [x] `docs/API.md` / `docs/DATABASE.md` updated for Phase 3 endpoints/models

## Phase 4 — Content generation, Jobs, Versioning
- [x] Redis + BullMQ wired up for real: `queue/redis.ts`, `queue/queues.ts`, `queue/queue-names.ts` (all 9 names from §27 reserved; only `content-generation` has a live Queue/Worker so far), `queue/workers/content-generation.worker.ts`, started in-process from `server.ts` via `.waitUntilReady()`
- [x] `Job` model + service (durable record BullMQ's own Redis-side job data doesn't provide long-term)
- [x] `ContentVersion` model + service (append-only, `Section.currentVersion` pointer, restore-without-delete)
- [x] Content generation endpoints: generate book / generate chapter (both skip already-generated sections) / generate-or-regenerate one section / get current content / list versions / restore version
- [x] Dashboard: real `failedJobs` count + new `recentJobs` list (the brief's "Job Dashboard", §27 — folded into the existing Dashboard page rather than a new nav item)
- [x] Frontend Content panel: per-section generate/regenerate buttons, live job-status polling (`refetchInterval` while any job is pending/running)
- [x] Backend tests: `content.service.test.ts` (dependency-free unit tests of the real generation logic, no Redis) + `content-generation.integration.test.ts` (full BullMQ round trip, `describe.skipIf` when Redis is unreachable) — 51 total backend tests, 50 passing reliably
- [x] `docs/API.md` / `docs/DATABASE.md` updated for Phase 4 endpoints/models
- [x] Live Playwright walkthrough (project → ideas → spec → outline → generate section content → generate-all-content correctly skips the already-done section). **Found and fixed a real bug**: `SectionContentRow`'s own content query had no invalidation trigger when its job finished — the "completed" badge would show while the button still said "Generate" (stale) instead of "Regenerate" with the new content, until something unrelated triggered a refetch. Fixed with a `useEffect` that invalidates that section's content query the moment its job first reaches `'completed'`.
- [~] `content-generation.integration.test.ts`'s last test (`restore an earlier version`) is occasionally flaky on this specific dev machine under heavy concurrent desktop load (Chrome/VS Code contention, observed load average >3.5) — diagnosed thoroughly: the generation logic itself is proven correct via dependency-free unit tests that always pass, and the full file passes reliably (3/3, ~24s) in isolation on an idle host. Not a code defect; documented in the test file. `fileParallelism: false` was also added to `vitest.config.ts` to reduce a related (and real) source of contention — ~10 test files each spinning up their own `mongodb-memory-server` concurrently.

## Phase 5 — Editor, AI assistant
- [x] `packages/shared`: `edit-pass.schemas.ts` (7 `EDIT_PASS_TYPES`), `ai-assistant.schemas.ts` (11 `ASSISTANT_ACTIONS` + request/result types), `manual-edit.schemas.ts`
- [x] Backend: `EditPass` model, `editing.service.ts` (`runEditingPipeline` standalone-testable + BullMQ wrapper), `editing.worker.ts` (mirrors `content-generation.worker.ts`), new `editing` queue in `queue/queues.ts`
- [x] Backend: `ai-assistant.service.ts` — selection-or-current-content resolution, per-action instruction table, `alternatives`/`fact_check` via structured/analysis provider calls
- [x] Backend: `content.service.saveManualEdit()` + `PUT .../sections/:sectionId/manual` route — always creates a new `ContentVersion` with `source: 'manual_edit'`
- [x] `server.ts` starts both workers via `Promise.all([...].waitUntilReady())`; `sync-indexes.ts` includes `EditPass`
- [x] Backend tests: 15 new (ai-assistant 7, manual-edit 3, editing-pipeline unit 2, editing-pipeline BullMQ round trip 3)
- [x] Frontend: `tiptap-editor.tsx`, `editor-toolbar.tsx`, `ai-assistant-panel.tsx`, `versions-panel.tsx`, `edit-passes-panel.tsx`, `section-navigator.tsx`, `book-editor-page.tsx` — full-screen route `/projects/:id/editor/:chapterId/:sectionId`, deliberately outside `AppShell`
- [x] "Edit" link added to `SectionContentRow` in the Content panel, routing into the editor
- [x] Live Playwright walkthrough — **found and fixed two real bugs**:
  1. `TiptapEditor`'s content-resync `useEffect` called `editor.commands.setContent(content)` (default `emitUpdate: true`) whenever the `content` prop changed — including the very first time AI-generated content loaded asynchronously after the editor had already mounted empty. That fired `onUpdate` as if the user had typed, marking the section dirty ("unsaved changes" badge) on load, before any real edit. Fixed by passing `{ emitUpdate: false }` — this is a genuine Tiptap v3 API (`SetContentOptions.emitUpdate`, default `true`), not a workaround.
  2. `EditPassesPanel`'s `passesQuery` had no invalidation trigger when the editing-pipeline job finished — unlike `SectionContentRow`/`BookEditorPage`, nothing refetched it after `jobsQuery` observed `status: 'completed'`. With the mock provider (job completes in tens of milliseconds), the panel would sit on "No editing pipeline runs yet." indefinitely even though all 7 passes existed server-side. Fixed with the same `useRef`-tracked status-transition `useEffect` pattern already used elsewhere in this codebase (see Phase 4's `SectionContentRow` fix above).
- [x] `docs/API.md` / `docs/DATABASE.md` updated for Phase 5 endpoints/models

## Notes / follow-ups
- Frontend has no component/unit tests yet (`npm run test -w @kdp/frontend`
  passes via `--passWithNoTests` — it was failing the root `npm test`
  before this fix, since vitest exits non-zero with zero test files).
  Frontend correctness so far has been verified via live Playwright
  browser walkthroughs instead (see Phase 1/2 notes above). Add real
  component tests (Vitest + Testing Library) when the UI surface is
  larger and regressions become harder to catch by hand.
- Rate limiter uses in-memory store; revisit with Redis store before
  multi-instance deployment (see ARCHITECTURE.md §5).
- MongoDB Atlas Search integration (§7 research, in-app content search)
  deferred until Phase 3 (Research) and a real Atlas cluster is available;
  local dev falls back to basic Mongo query filters behind the same
  search-layer interface so swapping in Atlas Search / Elasticsearch later
  doesn't change callers.
- Idea generation is synchronous (no BullMQ job) — fine for a handful of
  ideas per call, but should move onto the Phase 4 job queue once content
  generation (which is genuinely long-running) introduces BullMQ, for
  consistency.
- `packages/ai` pins `@anthropic-ai/sdk@^0.117.1` and `openai@^6.49.0` —
  both far newer than what training-data intuition would guess; verified
  against the live npm registry rather than assumed. `openai@7.x` requires
  Node 22 (this repo targets Node 20), which is why it's pinned to `6.x`.
- This dev session's local `apps/backend/.env` points `REDIS_URL` at a
  non-default port — ports 6379 and 6380 were both already occupied by
  unrelated pre-existing services on this particular sandbox machine.
  `.env` is gitignored, so this is a local-only override; `docker-compose.dev.yml`
  (and `.env.example`) still correctly default to the standard `6379`.
