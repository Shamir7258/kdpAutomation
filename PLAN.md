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

- [ ] **Phase 8 — Cover generation** (`packages/cover-engine`, `ImageProvider` abstraction, spine calculator)

- [ ] **Phase 9 — KDP validation** (`packages/kdp-validator`, configurable rules, preflight UI)

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
