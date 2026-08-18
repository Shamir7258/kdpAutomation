# Database — Phases 1–4

MongoDB via Mongoose. Collections below; more are added per phase (see
PLAN.md and ARCHITECTURE.md §4/§41 for the full eventual model list).

## `users`

| Field | Type | Notes |
|---|---|---|
| `email` | string | unique, lowercased, indexed |
| `passwordHash` | string | bcrypt, cost from `BCRYPT_COST` |
| `name` | string | |
| `role` | `'admin' \| 'user'` | default `'user'` |
| `organizationId` | ObjectId \| null | reserved for future org/team model (§48) |
| `createdAt` / `updatedAt` | Date | |

## `sessions`

Refresh-token sessions. One document per issued refresh token.

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | indexed |
| `tokenHash` | string | sha256 of the raw token — the raw token is never stored |
| `userAgent` / `ip` | string | audit trail |
| `expiresAt` | Date | TTL index — Mongo auto-deletes expired sessions |
| `revokedAt` | Date \| null | set on logout or rotation |

## `projects`

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId | indexed; every query is scoped to this |
| `organizationId` | ObjectId \| null | reserved (§48) |
| `name` | string | |
| `bookType` | `BookTypeId` enum | see `packages/shared/src/enums.ts` |
| `niche` | string | |
| `targetAudience` | string | |
| `language` | `LanguageCode` enum | |
| `status` | `ProjectStatus` enum | `DRAFT`, `RESEARCHING`, ... `ARCHIVED` |
| `workflowStatus` | `Map<WorkflowStage, WorkflowStageStatus>` | initialized to `pending` for every stage at creation; populated for real starting Phase 4 |
| `archivedAt` | Date \| null | set by `archive`, cleared by `restore` |
| `deletedAt` | Date \| null | soft delete, cleared by `restore` |
| `createdAt` / `updatedAt` | Date | |

Indexes: `{ userId: 1, name: 'text', niche: 'text' }` (compound —
lets `$text` search be scoped by `userId` without a full collection scan),
`{ userId: 1, updatedAt: -1 }` for the default sort.

## `prompttemplates` (Phase 2)

| Field | Type | Notes |
|---|---|---|
| `name` | string | unique — looked up by code, e.g. `BOOK_IDEA_GENERATOR` |
| `version` | number | bumped on edit (Phase 11 admin UI) |
| `systemPrompt` / `userPrompt` | string | `userPrompt` contains `{{variable}}` placeholders rendered by `AIProvider.generatePrompt()` |
| `variables` | string[] | documents which placeholders the template expects |
| `active` | boolean | `getActiveByName()` only returns active templates |

Seeded idempotently by `promptTemplateService.seedDefaults()` — called on
every backend boot and by `npm run migrate`.

## `aiusages` (Phase 2)

One row per AI call (§28). `provider`, `model`, `operation` (e.g.
`book_idea_generation`), `inputTokens`/`outputTokens`, `estimatedCostUsd`
(from `@kdp/ai`'s verified pricing table — `null` for an unrecognized
model rather than a guessed number), `userId`, `projectId`. Aggregated by
`aiUsageService.getSummary()` for the dashboard's AI usage card.

## `bookideas` (Phase 2)

| Field | Type | Notes |
|---|---|---|
| `projectId` / `userId` | ObjectId | ownership scope |
| `title`, `subtitle`, `targetAudience`, `problemSolved`, `uniqueAngle`, `contentType`, `differentiation` | string | AI-generated content (§10) |
| `estimatedPageCount` | number | |
| `difficulty` | `'beginner' \| 'intermediate' \| 'advanced'` | |
| `potentialRisks` | string[] | never fabricated as empty — the prompt requires an explicit "low risk" statement if genuinely low-risk |
| `status` | `'proposed' \| 'saved' \| 'rejected'` | |

## `bookspecifications` (Phase 2)

The canonical spec (§11) — unique on `projectId` (one per project).
`ideaId` references the `BookIdea` it was created from. `trimSizeId` is
constrained to the `TRIM_SIZE_IDS` enum (§19); a DB-backed configurable
`TrimSize` collection replaces this enum in Phase 7.

## `researches` (Phase 3)

One document per generate call (never overwritten — same "append, don't
replace" pattern as `bookideas`). `nicheSummary`, `audience`,
`potentialTopics[]`, `potentialSubtopics[]`, `searchTerms[]`,
`competitorThemes[]`, `contentOpportunities[]`,
`differentiationOpportunities[]`, `riskWarnings[]` — all synthesized by the
AI provider, never scraped.

## `chapters` / `sections` (Phase 3)

Deliberately **separate collections**, not embedded in `Project` or in
each other — per ARCHITECTURE.md §4 / brief §42 ("avoid putting the
entire book into a single MongoDB document"), and because Phase 4's
`ContentVersion` will hang off `Section` the same way.

| Collection | Key fields | Notes |
|---|---|---|
| `chapters` | `projectId`, `title`, `summary`, `order` | `{projectId: 1, order: 1}` index for ordered reads |
| `sections` | `chapterId`, `projectId`, `title`, `summary`, `order` | `{chapterId: 1, order: 1}` index; carries `projectId` too so section queries never need a chapter join |

Full outline regeneration (`POST /outline`) deletes and recreates all
chapters/sections for the project — the granular add/rename/delete/reorder
endpoints exist precisely so that operation isn't the only way to edit an
outline.

## `jobs` (Phase 4)

The durable, queryable record of every background job — BullMQ owns
*execution* (Redis-backed, retried, backed off per `queues.ts`'s
`defaultJobOptions`) but its own job data is pruned (`removeOnComplete`/
`removeOnFail`) and isn't meant to be queried by the app directly. `Job`
is what the dashboard and per-project progress UI actually read.

| Field | Type | Notes |
|---|---|---|
| `queueName`, `bullJobId` | string | Links back to the BullMQ job |
| `batchId` | string | Groups jobs enqueued by one "generate book"/"generate chapter" call, for aggregate progress |
| `projectId`, `chapterId`, `sectionId` | ObjectId | Scope |
| `status` | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'cancelled'` | |
| `attempts`, `progress`, `error` | | Updated by the worker around each processing attempt |

## `contentversions` (Phase 4)

Append-only — content is never overwritten (§14). `{sectionId, versionNumber}`
is unique. `Section.currentVersion` (added in Phase 4) points at whichever
version is "live"; restoring an older version just moves that pointer.

| Field | Type | Notes |
|---|---|---|
| `sectionId`, `chapterId`, `projectId` | ObjectId | |
| `versionNumber` | number | 1-indexed per section |
| `content` | string | The generated (or, from Phase 5, manually edited) text |
| `source` | `'ai_generated' \| 'manual_edit'` | Only `ai_generated` is produced today |

## Migrations

There's no relational schema to migrate yet. `npm run migrate` runs
`apps/backend/src/scripts/sync-indexes.ts`, which calls `Model.syncIndexes()`
for every model — the real story for keeping indexes in sync in
production, where `autoIndex` is disabled on boot (see
`apps/backend/src/db/mongoose.ts`).
