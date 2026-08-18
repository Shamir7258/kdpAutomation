# API Reference — Phases 1–4

Base URL: `/api`. All responses use the standard envelope:

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": { "code": "...", "message": "...", "requestId": "..." } }
```

Auth: send `Authorization: Bearer <accessToken>` on protected routes. The
refresh token travels only as an `httpOnly` cookie (`rt`, scoped to
`/api/auth`) — never read or set it directly.

## Auth

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/auth/register` | none | `{ email, password, name }` | Creates a user, sets `rt` cookie, returns `{ user, accessToken, accessTokenExpiresAt }` |
| POST | `/auth/login` | none | `{ email, password }` | Same response shape as register |
| POST | `/auth/refresh` | `rt` cookie | — | Rotates the session; old cookie is invalidated |
| POST | `/auth/logout` | `rt` cookie | — | Revokes the session, clears the cookie |
| GET | `/auth/me` | Bearer | — | Returns the current `UserDto` |

Password rules (enforced server-side via zod): ≥10 chars, at least one
uppercase, one lowercase, one digit.

## Projects

All routes require `Authorization: Bearer`. Every project is scoped to
`req.user.id` — one user can never read/write another's project (404, not
403, to avoid confirming existence).

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/projects` | `{ name, bookType, niche, targetAudience?, language? }` | `bookType` must be one of the registered `BookTypeId`s |
| GET | `/projects` | `?search&status&bookType&includeArchived&sortBy&sortDir&page&pageSize` | Paginated: `{ items, total, page, pageSize }` |
| GET | `/projects/:id` | — | 404 if not found or not owned |
| PATCH | `/projects/:id` | any subset of `{ name, niche, targetAudience, language, status }` | |
| POST | `/projects/:id/duplicate` | — | Copies core fields, resets workflow status, appends " (Copy)" |
| POST | `/projects/:id/archive` | — | Sets `archivedAt`, status → `ARCHIVED` |
| POST | `/projects/:id/restore` | — | Clears `archivedAt`/`deletedAt`, status → `DRAFT` if it was `ARCHIVED` |
| DELETE | `/projects/:id` | — | Soft delete (`deletedAt`) — hidden everywhere, restorable |

`includeArchived` accepts the literal strings `"true"`/`"false"` (or a
real boolean in a JSON body) — see `packages/shared/src/project.schemas.ts`
for why this isn't `z.coerce.boolean()`.

## Book ideas (Phase 2)

All routes require `Authorization: Bearer` and are scoped to a project the caller owns.

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/projects/:id/ideas` | `{ count? }` (1-10, default 5). Calls the configured `AIProvider`, records `AIUsage`, appends new ideas (never replaces existing ones — "regenerate" means "generate more"). Advances `workflowStatus.IDEA` to `completed` and `status` from `DRAFT` to `PLANNING`. |
| GET | `/projects/:id/ideas` | Lists all ideas for the project, newest first. |
| PATCH | `/projects/:id/ideas/:ideaId` | `{ status: "saved" \| "rejected" }` |

## Book specification (Phase 2)

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/projects/:id/specification` | `{ ideaId, tone?, readingLevel?, trimSizeId? }`. One spec per project — 409 if one already exists. Marks the idea `saved` and sets `workflowStatus.SPECIFICATION` to `completed`. |
| GET | `/projects/:id/specification` | 404 if none created yet. |

## Research (Phase 3)

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/projects/:id/research` | `{ marketplace? }` (default `amazon.com`). Two AI calls (`search()` then `analyze()`); each recorded separately in `AIUsage`. Does not scrape any live source — synthesized from the AI's training knowledge, always framed as directional, not verified market data. |
| GET | `/projects/:id/research` | Lists all research runs for the project, newest first (each generate call adds a new run, never overwrites). |
| GET | `/projects/:id/research/latest` | 404 if none generated yet. |

## Outline (Phase 3)

All routes require the project's book type to have `supportsOutline: true` (see `packages/shared/src/book-types.ts`) — otherwise generation returns 400. Chapters/sections are separate collections (not embedded in Project), per ARCHITECTURE.md §4.

| Method | Path | Notes |
|---|---|---|
| GET | `/projects/:id/outline` | Chapters with nested sections, both sorted by `order`. |
| POST | `/projects/:id/outline` | Full AI generation — **replaces** any existing outline. Requires a `BookSpecification` to exist first. |
| POST | `/projects/:id/outline/chapters` | `{ title, summary? }` — manual add |
| PATCH | `/projects/:id/outline/chapters/:chapterId` | `{ title?, summary? }` |
| DELETE | `/projects/:id/outline/chapters/:chapterId` | Also deletes its sections |
| POST | `/projects/:id/outline/chapters/reorder` | `{ chapterIds: string[] }` — full reordered list |
| POST | `/projects/:id/outline/chapters/:chapterId/regenerate` | AI regenerates this chapter's title/summary/sections, replacing its sections |
| POST | `/projects/:id/outline/chapters/:chapterId/sections` | `{ title, summary? }` |
| PATCH \| DELETE | `/projects/:id/outline/chapters/:chapterId/sections/:sectionId` | |
| POST | `/projects/:id/outline/chapters/:chapterId/sections/reorder` | `{ sectionIds: string[] }` |
| POST | `/projects/:id/outline/chapters/:chapterId/sections/:sectionId/regenerate` | AI regenerates one section |

## Content generation (Phase 4)

All routes are async — a `POST` enqueues a BullMQ job and returns `202` immediately (`201` on the plain endpoints was reserved for synchronous creates in earlier phases; content generation is genuinely background work). Poll `GET .../jobs` for status.

| Method | Path | Notes |
|---|---|---|
| POST | `/projects/:id/content` | Generate the whole book — enqueues one job per section that has **no content yet**. Re-running after a partial failure only fills the gaps (§44). |
| POST | `/projects/:id/content/chapters/:chapterId` | Same, scoped to one chapter. |
| POST | `/projects/:id/content/chapters/:chapterId/sections/:sectionId` | Generate **or regenerate** one section — always enqueues, regardless of existing content. |
| GET | `/projects/:id/content/chapters/:chapterId/sections/:sectionId` | Current content: `{ sectionId, currentVersionNumber, currentContent, versionCount }`. |
| GET | `/projects/:id/content/chapters/:chapterId/sections/:sectionId/versions` | All versions, newest first. Nothing is ever deleted (§14). |
| POST | `/projects/:id/content/chapters/:chapterId/sections/:sectionId/versions/:versionNumber/restore` | Moves the "current" pointer to an older version — doesn't delete the newer one. |
| GET | `/projects/:id/jobs` | All jobs for the project, newest first — used for progress polling. |

## Manual editing (Phase 5)

| Method | Path | Body / Notes |
|---|---|---|
| PUT | `/projects/:id/content/chapters/:chapterId/sections/:sectionId/manual` | `{ content }` (1–200,000 chars). Always creates a new `ContentVersion` with `source: 'manual_edit'` — same versioning/restore semantics as AI-generated content, never overwrites. |

## AI assistant (Phase 5)

Operates on the section's live editor selection when provided, otherwise falls back to the section's current saved content. No background job — synchronous, single AI call per request, recorded in `AIUsage`.

| Method | Path | Body |
|---|---|---|
| POST | `/projects/:id/chapters/:chapterId/sections/:sectionId/assistant` | `{ action, selectedText?, instruction?, ageRange?, count? }`. `action` ∈ `rewrite \| simplify \| age_appropriate \| alternatives \| expand \| shorten \| improve \| exercises \| questions \| fact_check \| custom`. `instruction` required for `custom`; `ageRange` required for `age_appropriate`. Response is one of `{ kind: 'text', text }`, `{ kind: 'alternatives', alternatives: string[] }`, `{ kind: 'analysis', summary, findings }` depending on the action. |

## Editing pipeline (Phase 5)

Async, mirrors content generation — `POST` enqueues a job on the `editing` BullMQ queue and returns `202`; poll `GET .../jobs`. Runs all 7 passes per invocation as one batch (shared `batchId`), each pass stored as its own `EditPass` document — never overwritten, so every pipeline run's full history is retained.

| Method | Path | Notes |
|---|---|---|
| POST | `/projects/:id/chapters/:chapterId/sections/:sectionId/edit-passes` | Enqueues a 7-pass run: grammar, clarity, consistency, structure, fact_checking, ai_detection_risk, final_review. The `ai_detection_risk` pass is an editorial-quality heuristic (repetitive/generic phrasing) — it makes no claim about evading or bypassing any AI-detection tool. |
| GET | `/projects/:id/chapters/:chapterId/sections/:sectionId/edit-passes` | All passes across all runs, newest first. Filter client-side by `batchId` to show one run's results (the frontend panel shows the latest batch). |

## Metadata (Phase 6)

One canonical metadata doc per project. `POST` (re)generates AI suggestions and upserts the doc — seeding the editable fields from the suggestions on first call, overwriting both on subsequent calls (this is a "regenerate the draft" action, not an append-only history like `ContentVersion`). `PATCH` is how the publisher finalizes fields without discarding the `aiSuggestions` record.

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/projects/:id/metadata` | No body. Requires a `BookSpecification` to exist first (404 otherwise). Seeds `title`/`subtitle`/`description`/`keywords` (first 7)/`categories` (first 2) from the AI suggestions; marks `workflowStatus.METADATA` completed. |
| GET | `/projects/:id/metadata` | 404 if not generated yet. |
| PATCH | `/projects/:id/metadata` | All fields optional: `title`, `subtitle`, `seriesName`, `seriesNumber`, `description` (≤4000 chars), `keywords` (≤7, ≤50 chars each — real KDP limits), `categories` (≤10, free text — not validated against a live/scraped Amazon taxonomy, §7), `authorName`, `primaryMarketplace`, `pricing: { currency, listPrice }` (manual only — the AI never suggests a price). |

## Interior generation (Phase 7)

Async, mirrors content generation — `POST` validates the project has an outline and generated content, then enqueues a job on the `document-generation` BullMQ queue and returns `202`; poll `GET .../jobs`. Every successful render creates a new `Interior` document — regenerating never deletes a prior download (same append-only philosophy as `ContentVersion`/`EditPass`).

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/projects/:id/interior` | `{ format: 'pdf' \| 'epub' \| 'docx', trimSizeId? }`. Requires an outline (≥1 chapter) and generated content (≥1 section with a current version) to exist first (400 otherwise). `trimSizeId` defaults to the project's `BookSpecification.trimSizeId` (falling back to `'6x9'`) when omitted. |
| GET | `/projects/:id/interior` | `InteriorDto[]` — all successful renders for the project, newest first: `{ id, projectId, batchId, format, trimSizeId, url, fileSizeBytes, createdAt }`. |

## Files (Phase 7)

Dev-only proxy for locally stored files — only relevant when `STORAGE_PROVIDER=local`. Under `s3`, `Interior.url` is a presigned S3 URL pointing directly at the object store, and this route returns 404 for it instead of proxying.

| Method | Path | Notes |
|---|---|---|
| GET | `/files/*` | Serves a file by its storage key. Every key this platform writes is namespaced `<category>/<userId>/...`; the route enforces ownership by checking that segment against the authenticated user (403/404 otherwise) rather than trusting the key alone. Returns 404 if the configured provider isn't `LocalStorageProvider`. |

## Cover generation (Phase 8)

Async, mirrors interior generation — `POST` requires only a `BookSpecification` to exist (no outline or generated content needed), then enqueues a job on the `cover-generation` BullMQ queue and returns `202`; poll `GET .../jobs`. Every successful render creates a new `Cover` document — regenerating never deletes a prior cover (same append-only philosophy as `Interior`/`ContentVersion`/`EditPass`).

| Method | Path | Body / Notes |
|---|---|---|
| POST | `/projects/:id/cover` | `{ paperType: 'white' \| 'cream' \| 'color', stylePrompt? }`. Requires a `BookSpecification` to exist (400 otherwise). Spine width is calculated from the specification's `estimatedPageCount` (falling back to 100), not any actually-generated interior's real page count — see ARCHITECTURE.md §5. |
| GET | `/projects/:id/cover` | `CoverDto[]` — all successful renders for the project, newest first: `{ id, projectId, batchId, paperType, pageCount, spineWidthIn, ebookCoverUrl, wrapCoverPdfUrl, createdAt }`. |

## Prompt templates (Phase 2, admin-only)

| Method | Path | Notes |
|---|---|---|
| GET | `/prompt-templates` | Lists all templates. Requires `role: admin`. Create/update/delete land in Phase 11 alongside the rest of the admin panel. |

## Dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/stats` | `DashboardStatsDto` — project counts, recent projects, AI/storage usage (zeroed until Phase 2/4 wire up real usage tracking) |

## Error codes

See `packages/shared/src/api.ts` `ERROR_CODES` for the full set
(`VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`RATE_LIMITED`, `INTERNAL_ERROR`, `INVALID_CREDENTIALS`,
`EMAIL_ALREADY_REGISTERED`, `INVALID_REFRESH_TOKEN`, `PROJECT_NOT_FOUND`).
