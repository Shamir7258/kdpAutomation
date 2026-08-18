# PLAN.md — KDP Automation Platform

## Status legend
`[ ]` not started · `[~]` in progress · `[x]` done

## Decision record (2026-08-18)

The repo previously held only a README describing a smaller, n8n-orchestrated
"KDP Review Gate" (Express + SQLite + vanilla JS). Per explicit user
direction, that direction is **replaced** by the full in-house SaaS platform
described in the project brief: React/TS frontend, Node/Express/MongoDB
backend, Redis + BullMQ job system, no n8n dependency. The review-gate
concept (human approval before publish) is preserved as a *stage inside the
new workflow engine* (see ARCHITECTURE.md §Workflow Engine), not as a
separate n8n-fed service.

## Phased delivery order

This mirrors §49 of the brief. Each phase must produce a working, testable
vertical slice (backend + frontend + tests) before moving to the next.

- [~] **Phase 0 — Foundation**
  - [x] PLAN.md, ARCHITECTURE.md, TODO.md
  - [x] Monorepo scaffold (npm workspaces)
  - [x] `packages/shared` — cross-cutting TS types & zod schemas
  - [x] `packages/config` — strongly typed env config
  - [x] Backend app skeleton (Express, logging, error handling, DB/Redis bootstrap)
  - [x] Frontend app skeleton (Vite + React + TS + Tailwind + shadcn/ui)
  - [x] Docker Compose (mongo, redis, backend, frontend, nginx) + Dockerfiles
  - [x] Root dev scripts (`npm run dev`, `build`, `test`, `lint`, `format`, `docker:up/down`)

- [x] **Phase 1 — Auth, Projects, Dashboard**
  - [x] User model, password hashing, access/refresh JWT, session storage, RBAC middleware
  - [x] Auth routes: register, login, refresh, logout
  - [x] Project model + CRUD (create/list/get/rename/duplicate/archive/restore/delete/search/filter/sort)
  - [x] Dashboard aggregate stats endpoint
  - [x] Frontend: login/register pages, auth context + protected routes, sidebar shell, dashboard page, projects list/create UI
  - [x] Backend tests: auth flows, project CRUD, RBAC (mongodb-memory-server + supertest) — 24 tests passing
  - [x] Frontend smoke test (Playwright browser walkthrough; found and fixed a real `includeArchived` filter bug — see TODO.md)

- [x] **Phase 2 — Book types, Book specification, Idea generation**
  - [x] `BookType` plugin registry (low/medium/high content types) — `packages/shared/src/book-types.ts` (static catalog) + `apps/backend/src/modules/book-types/book-type.registry.ts` (runtime `register()`/`get()`/`list()`)
  - [x] AI provider abstraction (`packages/ai`) — Claude (`claude-opus-5` default), OpenAI (`gpt-5` default), and Mock (deterministic, default in dev/test) providers behind one `AIProvider` interface; structured output via each SDK's native schema-validated path; verified cost-tracking pricing table
  - [x] Prompt template system — `PromptTemplate` model + seeded `BOOK_IDEA_GENERATOR` template; admin-only `GET /api/prompt-templates`. Full admin CRUD UI deferred to Phase 11 (documented in ARCHITECTURE.md §5)
  - [x] Book idea generation — `POST/GET /api/projects/:id/ideas`, `PATCH .../ideas/:ideaId` (select/reject). Implemented as a **synchronous** endpoint, not a background job — see ARCHITECTURE.md §5 assumption (BullMQ infra is Phase 4)
  - [x] BookSpecification — model + `POST/GET /api/projects/:id/specification`, created from a selected idea; frontend panel replaces the idea list once a spec exists
  - [x] AIUsage tracking wired into idea generation; dashboard's AI usage card now shows real cost/call counts
  - [x] Backend tests: idea generation/list/status update, ownership isolation, workflow-status transitions, spec creation/duplicate-prevention/404 — all using `MockAIProvider` (no paid API calls in tests)
  - [x] Frontend: Book Generator panel (generate → select/reject → create specification → spec display) embedded in the project detail page; verified via a live Playwright walkthrough against the mock provider

- [x] **Phase 3 — Research, Outline**
  - [x] `ResearchProvider` abstraction (`search`/`analyze`/`generateInsights`) — one implementation today (`AIResearchProvider`, backed by `@kdp/ai`), synthesizes findings without scraping Amazon or any live source, per §7's explicit prohibition
  - [x] Research — `POST/GET /api/projects/:id/research`, `GET .../research/latest`; frontend panel with an explicit "directional, not verified market data" disclaimer
  - [x] Outline generator — `Chapter`/`Section` models (separate collections, not embedded, per §42), full AI generation + manual add/rename/delete/reorder for both chapters and sections, plus AI regenerate-one-chapter/regenerate-one-section
  - [x] Drag-and-drop UI — native HTML5 DnD (no new dependency), chapters and sections both reorderable
  - [x] Book types without `supportsOutline` (journals, planners, etc.) are blocked from outline generation with a clear message, not silently given a nonsensical chaptered outline
  - [x] Backend tests: research generation/list/ownership, outline generation/reject-for-low-content-type/manual-CRUD/regenerate — all via `MockAIProvider`
  - [x] Frontend verified via live Playwright walkthrough: register → project → research → ideas → spec → outline → add chapter, zero console errors

- [x] **Phase 4 — Content generation, Jobs, Versioning**
  - [x] BullMQ + Redis wired up for real — `content-generation` queue/worker running in-process alongside the HTTP server (no separate worker container yet; see ARCHITECTURE.md §5). The other 8 queue names from §27 are reserved constants, not yet Queue instances — created when their phase adds a real Worker
  - [x] Chapter/section content generation jobs: `POST /content` (whole book), `.../chapters/:id` (one chapter), `.../sections/:id` (one section, always regenerates) — generateBook/generateChapter skip sections that already have content, giving free resume-from-failure (§44) with no extra state tracking
  - [x] `Job` model (durable, queryable record of every BullMQ job — status/attempts/progress/error/timestamps) + `ContentVersion` model (append-only, `Section.currentVersion` pointer, restore-without-delete)
  - [x] Job dashboard — folded into the existing Dashboard page (`recentJobs` + real `failedJobs` count) rather than a separate nav item, matching the per-project-workflow pattern from Phases 2/3; per-project job status is polled live in the new Content panel
  - [x] Backend tests: dependency-free unit test of the actual generation logic (`content.service.test.ts`, no Redis) + a full BullMQ round-trip integration suite (enqueue → worker → ContentVersion → restore) gated on Redis being reachable
  - [x] Frontend Content panel (per-section generate/regenerate, live job-status polling, version count) verified via live Playwright walkthrough; a real bug found and fixed during that walkthrough — see TODO.md

- [x] **Phase 5 — Editor, AI assistant**
  - [x] Full-screen focused editor (`/projects/:id/editor/:chapterId/:sectionId`, outside `AppShell` chrome) — Tiptap v3 rich text editor with Markdown as the storage format throughout (`tiptap-markdown`); toolbar (bold/italic/strike/code, headings, lists, blockquote, table, page-break stand-in, undo/redo); section navigator sidebar; manual save (`PUT .../manual`, always creates a new `ContentVersion`) alongside the existing AI regenerate action
  - [x] AI assistant panel — operates on the live editor selection or falls back to the section's current content; actions: rewrite, simplify, age-appropriate, alternatives (structured output, pick one to insert), expand, shorten, improve, exercises, questions, fact-check (analysis with findings), custom instruction. `AIProvider.editContent`/`generateStructuredData`/`analyzeContent` reused — no new provider methods needed
  - [x] Editing pipeline — new `editing` BullMQ queue/worker (mirrors `content-generation`), runs 7 independent passes (grammar, clarity, consistency, structure, fact-checking, ai-detection-risk, final-review) per run, each stored as its own `EditPass` document (never overwritten); `ai_detection_risk` pass is framed explicitly as an editorial-quality heuristic, not a detector-evasion claim (§ legal/ethical constraint from the brief)
  - [x] Versions panel — lists all `ContentVersion`s for a section with current-badge and restore-without-delete
  - [x] Backend tests: AI assistant (auth/validation/selection-fallback/alternatives/fact-check — 7 tests), manual-edit versioning (3 tests), editing-pipeline unit logic (2 tests, no Redis), editing-pipeline BullMQ round trip (3 tests, gated on Redis) — 15 new tests, all via `MockAIProvider`
  - [x] Frontend verified via live Playwright walkthrough (register → project → research → ideas → spec → outline → generate content → open editor → type → save → AI rewrite → insert → versions tab → run editing pipeline → passes rendered). Found and fixed two real bugs during that walkthrough — see TODO.md

- [x] **Phase 6 — Metadata generator**
  - [x] `Metadata` model — one canonical doc per project (like `BookSpecification`); `POST` generates AI suggestions (titles/subtitles/description/keywords/categories via `AIProvider.generateMetadata`, already built in Phase 2's `packages/ai`) and seeds the editable fields, `PATCH` finalizes them without discarding the raw `aiSuggestions` record
  - [x] Real KDP publishing constraints encoded as validation, not fabricated: up to 7 keyword phrases (50 chars each), ~4000-char description cap. Categories are free text, not validated against a live/scraped Amazon taxonomy (§7 — no scraping)
  - [x] Pricing is manual-only (currency + list price) — the AI never suggests a price, to avoid any implication of a sales/performance promise
  - [x] Frontend `MetadataPanel` folded into the project detail page (same pattern as Research/Ideas/Outline/Content, not a standalone top-level nav item) — AI title alternatives are clickable chips, keyword/category counters show the KDP limits live
  - [x] Removed the orphaned top-level `/metadata` sidebar nav item + `ComingSoonPage` route now that the real per-project panel exists — matches the precedent set in Phase 3 for Research
  - [x] Backend tests: generate seeds fields + marks `workflowStatus.METADATA` completed, 404 without a specification first, 404 fetching before generation, PATCH finalizes without discarding suggestions, keyword-limit validation, cross-user 404 isolation — 7 tests, all via `MockAIProvider`
  - [x] Frontend verified via live Playwright walkthrough (generate → AI suggestions shown → edit keywords/author/price → save → persisted)
  - [x] `docs/API.md` / `docs/DATABASE.md` updated for Phase 6 endpoints/models

- [x] **Phase 7 — Interior generation** (`packages/document-engine`: PDF/EPUB/DOCX, trim sizes, templates)
  - [x] New `packages/storage` (`@kdp/storage`) — `StorageProvider` abstraction with `LocalStorageProvider` (local disk under `STORAGE_LOCAL_ROOT`, dev-only, files served back via new `GET /api/files/*` route with per-key ownership checks) and `S3StorageProvider` (AWS SDK v3, presigned GET URLs with a 1-hour TTL, works against AWS S3 or any S3-compatible endpoint via an optional custom `endpoint`), selected via `STORAGE_PROVIDER` through `createStorageProvider(config)` — mirrors the existing `@kdp/ai` provider-selection pattern exactly, including fail-fast validation when `s3` is chosen without `AWS_S3_BUCKET`/`AWS_REGION`
  - [x] New `packages/document-engine` (`@kdp/document-engine`) — pure functions rendering a `BookManuscript` (the same canonical Markdown storage format used since Phase 4/5) into PDF (`pdfkit`, pure JS, no headless-browser dependency), DOCX (`docx`/docx.js), and EPUB (`epub-gen-memory`, in-memory, no temp-file I/O), sized to real KDP trim sizes (`5x8` through `8.5x11`) with a conservative fixed 0.75" margin — real page-count-dependent KDP gutter-margin rules are deliberately deferred to Phase 9's KDP validator (see ARCHITECTURE.md §5)
  - [x] Shared `markdown-blocks.ts` walks `markdown-it`'s token stream into a block model consumed by both the PDF and DOCX renderers; EPUB renders Markdown→HTML directly via `markdown-it`'s own `.render()` since `epub-gen-memory` takes HTML. Inline formatting (bold/italic/links) is flattened to plain text and tables are skipped — documented scope limits, not bugs. EPUB's chapter granularity is per-*section* (finer than the book's own chapter/section split), with each book chapter's title rendered as an `<h1>` above its first section
  - [x] Backend: `Interior` model (append-only — one doc per successful render, same philosophy as `ContentVersion`/`EditPass`), `interior.service.ts` (`generate`/`list`/`runInteriorGeneration`, the last standalone-testable and dependency-free of BullMQ, mirroring `runContentGeneration`/`runEditingPipeline`), `interior.worker.ts` on the `document-generation` queue (`QUEUE_NAMES.DOCUMENT_GENERATION`, reserved since Phase 4, unused until now) — started in-process from `server.ts` alongside the other two workers
  - [x] Routes at `/api/projects/:id/interior` — `POST` validates an outline and generated content already exist (400 otherwise), defaults `trimSizeId` to the project's `BookSpecification.trimSizeId` (falling back to `'6x9'`), enqueues and returns `202 JobDto`; `GET` lists successful renders newest-first — plus new dev-only `GET /api/files/*` proxy for `LocalStorageProvider`, enforcing ownership via the `<userId>` segment of the namespaced storage key
  - [x] `job.service.ts`'s `createPending()` had its `chapterId`/`sectionId` inputs changed from required to optional (backward compatible) — interior-generation jobs are project-level, not scoped to one chapter/section, unlike every prior job type; `sync-indexes.ts` now includes `InteriorModel`
  - [x] Package-level tests, real I/O, no mocking: `packages/storage` (8 tests, real disk I/O in a temp directory) + `packages/document-engine` (10 tests — PDF output asserted via the `%PDF-` magic bytes, DOCX/EPUB via the `PK` ZIP magic bytes) — 18 new tests, all passing
  - [x] Backend tests: 9 new (`interior.service.test.ts` — 3 unit tests against a real temp-dir `LocalStorageProvider`, no Redis; `interior.routes.test.ts` — 6 enqueue-only HTTP tests, same pattern as `editing.routes.test.ts`). Full backend suite: 81/82 passing (1 pre-existing, already-documented host-contention flake unrelated to this phase)
  - [x] Frontend `InteriorPanel` (format/trim-size pickers, job-status polling, download list) folded into the project detail page; the now-stale top-level `/interior` placeholder nav item + route were removed, same precedent as Metadata in Phase 6
  - [x] Live Playwright walkthrough (continuing the Phase 5/6 flow through metadata → generate a PDF interior → poll to completion → download). **Found and fixed a real bug**: the download button used a plain `<a href download>`, but this app's access token lives in memory, not a cookie — a bare anchor navigation to the authenticated `/api/files/...` route sends no `Authorization` header and would 401. Fixed with a new `downloadFile()` helper in `api-client.ts` that fetches with the bearer header and downloads via a Blob for our own relative URLs, while opening absolute (S3 presigned) URLs directly since those need no such header
  - [x] `docs/API.md` / `docs/DATABASE.md` / `ARCHITECTURE.md` updated for Phase 7 packages/endpoints/models

- [x] **Phase 8 — Cover generation** (`packages/cover-engine`, `ImageProvider` abstraction, spine calculator)
  - [x] New `ImageProvider` abstraction in `packages/ai` (separate from `AIProvider` — not every LLM provider has an image endpoint): `generateImage(prompt, options?) → { data: Buffer, contentType: string }`, implemented by `OpenAIImageProvider` (OpenAI Images API, `gpt-image-1`, base64-encoded output) and `MockImageProvider` (deterministic, no network — renders an SVG, solid color hashed from the prompt text plus the prompt overlaid, to a PNG via `sharp`), selected via the pre-existing `IMAGE_PROVIDER` env var (`openai`\|`mock`, default `mock`, unused since Phase 0) through `createImageProvider(config)` — mirrors `createAIProvider`'s fail-fast pattern. New `sharp` dependency in `packages/ai`; backend singleton wrapper `image-provider.instance.ts` mirrors `ai-provider.instance.ts`
  - [x] New `packages/cover-engine` (`@kdp/cover-engine`) — `calculateSpineWidthInches(pageCount, paperType)` in `spine.ts` using real, publicly documented KDP per-page spine-thickness constants (white `0.002252"`, cream `0.0025"`, color `0.002347"`); below `MIN_SPINE_WIDTH_FOR_TEXT_IN` (`0.0625"`) the spine is left blank, matching KDP's own guidance that thin books have no room for spine lettering
  - [x] `compositeTitleOntoImage()` in `ebook-cover.ts` takes the AI-generated artwork (prompted to contain no text/lettering) and uses `sharp` to composite a semi-transparent band + title/subtitle/author SVG text overlay across the lower third — this is both the final eBook cover and the front panel reused by the wrap cover, so both formats match. `generateWrapCover()` in `wrap-cover.ts` builds the full print wrap as one `pdfkit` PDF (back + spine + front, sized to 2×trim width + spine width + 2×0.125" bleed by trim height + 2×0.125" bleed); `trim-sizes.ts` duplicates the real KDP trim sizes, decoupled from `@kdp/shared` (same pattern as `packages/document-engine`). Top-level `generateCover(input)` in `index.ts` ties it together into a `GeneratedCover`
  - [x] Backend `apps/backend/src/modules/cover/`, mirroring `modules/interior/`: append-only `Cover` model (one doc per successful render); `cover.service.ts`'s `generate()` requires only a `BookSpecification` (no outline/content needed, unlike interior generation) and its standalone `runCoverGeneration()` builds a no-text image prompt from the spec, calls the configured `ImageProvider` and `generateCover()`, saves both outputs via the configured `StorageProvider`, creates the `Cover` doc, and marks `Project.workflowStatus.COVER = 'completed'`; deliberately does not record `AIUsage` for the image call (token-based cost schema doesn't fit image pricing) — see ARCHITECTURE.md §5. New queue/worker on the previously-reserved `cover-generation` queue (`QUEUE_NAMES.COVER_GENERATION`, since Phase 4), started in-process from `server.ts` alongside the other three workers
  - [x] Page count for the spine calculation comes from `BookSpecification.estimatedPageCount` (falling back to 100), not any actually-generated interior's real page count — a deliberate scope decision keeping cover generation independent of interior generation (documented in ARCHITECTURE.md §5)
  - [x] Routes at `/api/projects/:id/cover` (`generateCoverSchema` in `packages/shared/src/cover.schemas.ts`): `POST` → `202 JobDto`; `GET` → `200 CoverDto[]`. `sync-indexes.ts` now includes `CoverModel`
  - [x] Frontend `cover-panel.tsx` folded into the project detail page (same embedded pattern as Research/Outline/Content/Metadata/Interior, never a standalone nav item — the `/cover` sidebar placeholder + route were removed, same precedent as Metadata/Interior); paper-type picker, optional style-prompt input, job-status polling like `interior-panel.tsx`, plus an inline `<img>` thumbnail preview of each past eBook cover (fetched as an authenticated blob via the same in-memory-bearer-token workaround as Interior's download button) and a "Download wrap PDF" button via the existing `downloadFile()` helper
  - [x] `packages/cover-engine` tests, real generated output, no mocking: `spine.test.ts` (2 tests, verifies the real per-page constants) + `generate-cover.test.ts` (5 tests, PDF asserted via `%PDF-` magic bytes, PNG via its own magic bytes) — 7 tests
  - [x] Backend tests: 8 new (`cover.service.test.ts` unit, `cover.routes.test.ts` enqueue-only HTTP). Full backend suite: **88/88 passing**
  - [x] **Found and fixed a significant platform-wide bug, not specific to this phase**: every job-enqueuing service enqueued the BullMQ job *before* creating its Mongo `Job` tracking doc — a race that let a fast worker (mock providers) finish and look up that doc before it existed, silently dropping the `completed` status update forever even though the actual work succeeded. This is what made interior/cover generation appear to hang in the frontend despite the files already existing. Fixed platform-wide by creating the Job doc first and passing its id as BullMQ's explicit `jobId`, in all four services (`content`, `editing`, `interior`, `cover`) — see TODO.md for the full diagnosis. This also retroactively explains (and fixes) the `content-generation.integration.test.ts` flake that had been attributed to host contention since Phase 4.
  - [x] `docs/API.md` / `docs/DATABASE.md` / `ARCHITECTURE.md` updated for Phase 8 packages/endpoints/models

- [x] **Phase 9 — KDP validation** (`packages/kdp-validator`, configurable rules, preflight UI)
  - [x] New `packages/kdp-validator` (`@kdp/kdp-validator`) — dependency-free rules engine: a `ValidationRule` interface (`{ id, label, category: 'metadata'|'content'|'interior'|'cover', check(context) }`) where every `check` is a pure function with no I/O, plus a module-level registry (`registerRule()`/`listRules()`/`runValidation(context)`) — registering a new rule via `registerRule()` is the actual extension point (the "configurable rules" part of the brief), not a hardcoded if/else chain
  - [x] 10 built-in rules registered across `rules/metadata-rules.ts` (6: metadata exists, title non-empty, description non-empty and ≤4000 chars matching `packages/shared/src/metadata.schemas.ts`'s save-time limit, keywords — error if >7, warning if 0 or under 7 slots used, at least one category selected, author name set), `rules/content-rules.ts` (2: outline exists — skipped for book types where `bookType.supportsOutline` is false; every outline section has generated content, naming exactly how many are missing), `rules/interior-rules.ts` (3: an interior exists, most recent interior's trim size matches the current `BookSpecification`, and a margin/page-count consistency check — warns when a PDF interior's `pageCount` exceeds 700 per KDP's published gutter-margin guidance, explicitly framed as guidance to verify against KDP's current official spec rather than an asserted pass/fail), `rules/cover-rules.ts` (2: a cover exists, most recent cover's spine width was calculated from a page count matching the current `BookSpecification.estimatedPageCount`) — each file registers its rules as an import side effect via `index.ts`
  - [x] Closes the loop deferred in Phase 7 (ARCHITECTURE.md §5): `packages/document-engine`'s PDF generator now reports its actual rendered page count via `doc.bufferedPageRange().count` on `GeneratedInterior.pageCount` (PDF-only — EPUB is reflowable with no fixed page count, DOCX's true page count depends on the reader's own renderer, so both stay `undefined` rather than reporting a guess), plumbed through to the `Interior` Mongo model and `InteriorDto`
  - [x] `packages/kdp-validator` tests: `validation.test.ts`, 10 tests, all pure (no I/O, no mocking) — full rule set against empty and fully-ready contexts, plus each rule's edge cases (keyword-count boundaries, description-length boundary, the 700-page margin threshold, the outline-skip for non-outline book types)
  - [x] New `packages/shared/src/validation.schemas.ts` — `FINDING_SEVERITIES`, `FINDING_CATEGORIES`, `ValidationFindingDto` (`{ ruleId, category, severity, message }`), `ValidationReportDto` (`{ findings, readyToPublish, checkedAt }`)
  - [x] Backend `apps/backend/src/modules/validation/` — architecturally different from every prior generation module: **synchronous**, no BullMQ job, no stored history, no new Mongo model (same reasoning as Phase 2's book-idea generation being sync, per ARCHITECTURE.md's assumptions — a preflight check is fast, pure-function reads with no AI/rendering call, so it doesn't need queue infrastructure)
  - [x] `validation.service.ts`'s `run(userId, projectId)` loads the project (ownership + `bookType.supportsOutline`), `BookSpecification`, `Metadata`, all `Section` docs, and the full `Interior`/`Cover` lists (via the existing newest-first `interiorService.list()`/`coverService.list()`), assembles a `ValidationContext`, calls `runValidation()`, and returns a `ValidationReportDto` (`readyToPublish` true only when zero `error`-severity findings — `warning` findings never block it); always recomputed fresh, never cached
  - [x] Route: `GET /api/projects/:id/validation` → `200 ValidationReportDto`. No `POST` — nothing to enqueue
  - [x] Backend tests: 4 new (`validation.test.ts`) — auth required, a brand-new project reports every expected error rule id with `readyToPublish: false`, 404 for a non-owner, and a fully-seeded "everything satisfied" scenario reports zero findings with `readyToPublish: true`
  - [x] Frontend `apps/frontend/src/features/validation/validation-panel.tsx` folded into the project detail page (same embedded-panel pattern as every prior phase, never a standalone nav item — the `/validation` sidebar placeholder and route were removed, same precedent as `/metadata`/`/interior`/`/cover`); simpler than the async panels — a plain `useQuery` plus a manual "Re-check" refetch button, no job polling; findings grouped by category with severity-appropriate styling and a top banner distinguishing "ready to publish" from "N blocking issues remain"
  - [x] Full backend suite: **92/92 passing**. Live Playwright walkthrough (continuing Phase 5–8's flow through validation) found no new bugs — the panel's manual "Re-check" design worked as intended on the first pass (the query fires once on mount with no auto-invalidation tied to other panels' mutations, so the first snapshot reflects whatever existed at page-load time; clicking Re-check correctly recomputed to "Ready to publish" once outline/content/metadata/interior/cover were all in place)
  - [x] `docs/API.md` / `docs/DATABASE.md` / `ARCHITECTURE.md` updated for Phase 9 packages/endpoints/models

- [ ] **Phase 10 — Export system** (package assembly + ZIP)

- [ ] **Phase 11 — Admin panel**

- [ ] **Phase 12 — Testing & production hardening**

## Working agreement

- No fake/placeholder implementations of core functionality. Where an
  external API isn't configured (no API key), the provider interface must
  still be real, backed by a documented mock used in dev/test.
- Every phase ends with: tests passing, lint clean, typecheck clean,
  TODO.md updated, docs updated.
- Ambiguous requirements get a sensible production-grade default, recorded
  in ARCHITECTURE.md §Assumptions, and we move on — no blocking on minor
  decisions.
