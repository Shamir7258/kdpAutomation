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
