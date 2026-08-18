export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export const PROJECT_STATUSES = [
  'DRAFT',
  'RESEARCHING',
  'PLANNING',
  'GENERATING',
  'EDITING',
  'DESIGNING',
  'VALIDATING',
  'READY',
  'FAILED',
  'ARCHIVED',
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Stages of the end-to-end workflow engine (§26 of the brief). Populated from Phase 4 onward. */
export const WORKFLOW_STAGES = [
  'RESEARCH',
  'IDEA',
  'SPECIFICATION',
  'OUTLINE',
  'CONTENT',
  'EDIT',
  'METADATA',
  'INTERIOR',
  'COVER',
  'VALIDATION',
  'EXPORT',
] as const;
export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const WORKFLOW_STAGE_STATUSES = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export type WorkflowStageStatus = (typeof WORKFLOW_STAGE_STATUSES)[number];

export const BOOK_CONTENT_TIERS = ['low', 'medium', 'high'] as const;
export type BookContentTier = (typeof BOOK_CONTENT_TIERS)[number];

/** Initial BookType catalog (§6). New types register into this via the BookType plugin registry (Phase 2). */
export const BOOK_TYPE_IDS = [
  'journal',
  'notebook',
  'diary',
  'planner',
  'logbook',
  'tracker',
  'puzzle_book',
  'activity_book',
  'coloring_book',
  'workbook',
  'guided_journal',
  'non_fiction',
  'educational',
  'how_to_guide',
  'short_story_collection',
] as const;
export type BookTypeId = (typeof BOOK_TYPE_IDS)[number];

/** Common KDP trim sizes (§19). Stored as an id string on BookSpecification for now; a DB-backed configurable TrimSize collection lands in Phase 7. */
export const TRIM_SIZE_IDS = ['5x8', '5.25x8', '5.5x8.5', '6x9', '7x10', '8x10', '8.5x11'] as const;
export type TrimSizeId = (typeof TRIM_SIZE_IDS)[number];

export const READING_LEVELS = ['general', 'beginner', 'intermediate', 'advanced', 'children', 'young_adult'] as const;
export type ReadingLevel = (typeof READING_LEVELS)[number];

export const LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'ja',
] as const;
export type LanguageCode = (typeof LANGUAGES)[number];
