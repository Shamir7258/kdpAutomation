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

- [ ] **Phase 6 — Metadata generator**

- [ ] **Phase 7 — Interior generation** (`packages/document-engine`: PDF/EPUB/DOCX, trim sizes, templates)

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
