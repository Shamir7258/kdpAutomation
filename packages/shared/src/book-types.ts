import type { BookContentTier, BookTypeId, LanguageCode } from './enums.js';

export interface BookTypeDefinition {
  id: BookTypeId;
  label: string;
  tier: BookContentTier;
  description: string;
  /** Low-content books (journals, planners) rarely need a chaptered outline; high-content books do. */
  supportsOutline: boolean;
  supportsChapters: boolean;
  /** Typical page count range, used as a default hint for spec/idea generation. */
  typicalPageRange: [number, number];
  /** Injected into AI idea-generation prompts to bias output toward the type's conventions. */
  ideaPromptHint: string;
}

/**
 * Static catalog backing the `BookType` plugin architecture (§6). Kept as
 * plain data in `shared` so both frontend (labels/filters) and backend
 * (generation prompt hints) read the same source of truth. The backend's
 * `modules/book-types` registry (Phase 2) wraps this with a `register()`
 * function so new types can be added without touching call sites — see
 * that module for the extensibility mechanism.
 */
export const BOOK_TYPE_CATALOG: Record<BookTypeId, BookTypeDefinition> = {
  journal: {
    id: 'journal',
    label: 'Journal',
    tier: 'low',
    description: 'A guided or blank journal for daily reflection, gratitude, or a specific practice.',
    supportsOutline: false,
    supportsChapters: false,
    typicalPageRange: [100, 150],
    ideaPromptHint: 'Focus on a specific daily/weekly prompt structure and a clear use-case audience.',
  },
  notebook: {
    id: 'notebook',
    label: 'Notebook',
    tier: 'low',
    description: 'A blank or lightly templated notebook (lined, dotted, grid, or themed).',
    supportsOutline: false,
    supportsChapters: false,
    typicalPageRange: [100, 120],
    ideaPromptHint: 'Focus on page layout style and a distinctive cover/theme angle rather than written content.',
  },
  diary: {
    id: 'diary',
    label: 'Diary',
    tier: 'low',
    description: 'A dated or undated diary for personal record-keeping.',
    supportsOutline: false,
    supportsChapters: false,
    typicalPageRange: [100, 200],
    ideaPromptHint: 'Consider whether it should be dated (e.g. 52-week) or undated, and the target life stage/interest.',
  },
  planner: {
    id: 'planner',
    label: 'Planner',
    tier: 'low',
    description: 'A daily/weekly/monthly planner with structured layout sections.',
    supportsOutline: false,
    supportsChapters: false,
    typicalPageRange: [100, 160],
    ideaPromptHint: 'Specify the planning cadence (daily/weekly/monthly) and any goal-tracking sections.',
  },
  logbook: {
    id: 'logbook',
    label: 'Logbook',
    tier: 'low',
    description: 'A structured log for repeated record entries (e.g. fitness, maintenance, feeding).',
    supportsOutline: false,
    supportsChapters: false,
    typicalPageRange: [100, 120],
    ideaPromptHint: 'Define exactly which fields each log entry needs — this is a template-design task.',
  },
  tracker: {
    id: 'tracker',
    label: 'Tracker',
    tier: 'low',
    description: 'A tracker for habits, symptoms, expenses, or similar repeated metrics.',
    supportsOutline: false,
    supportsChapters: false,
    typicalPageRange: [100, 120],
    ideaPromptHint: 'Name the specific metric(s) being tracked and the tracking interval.',
  },
  puzzle_book: {
    id: 'puzzle_book',
    label: 'Puzzle Book',
    tier: 'medium',
    description: 'A collection of puzzles (word search, sudoku, crossword, etc.) with an answer key.',
    supportsOutline: true,
    supportsChapters: false,
    typicalPageRange: [100, 130],
    ideaPromptHint: 'Specify puzzle type, difficulty progression, and target age/skill level.',
  },
  activity_book: {
    id: 'activity_book',
    label: 'Activity Book',
    tier: 'medium',
    description: 'A mix of activities (mazes, dot-to-dot, coloring, puzzles) usually for children.',
    supportsOutline: true,
    supportsChapters: false,
    typicalPageRange: [60, 100],
    ideaPromptHint: 'Specify age range and the mix of activity types; keep instructions age-appropriate.',
  },
  coloring_book: {
    id: 'coloring_book',
    label: 'Coloring Book',
    tier: 'medium',
    description: 'A themed collection of illustrations for coloring.',
    supportsOutline: true,
    supportsChapters: false,
    typicalPageRange: [50, 100],
    ideaPromptHint: 'Define a clear visual theme and complexity level matched to the target age group.',
  },
  workbook: {
    id: 'workbook',
    label: 'Workbook',
    tier: 'medium',
    description: 'Exercises and worksheets around an educational or skill-building topic.',
    supportsOutline: true,
    supportsChapters: true,
    typicalPageRange: [80, 150],
    ideaPromptHint: 'Structure around a clear skill progression with practice exercises per section.',
  },
  guided_journal: {
    id: 'guided_journal',
    label: 'Guided Journal',
    tier: 'medium',
    description: 'A journal with substantial written prompts, exercises, or a structured program.',
    supportsOutline: true,
    supportsChapters: true,
    typicalPageRange: [120, 180],
    ideaPromptHint: 'Design a clear thematic arc across the journal (e.g. weekly themes over 12 weeks).',
  },
  non_fiction: {
    id: 'non_fiction',
    label: 'Non-fiction Book',
    tier: 'high',
    description: 'A full-length non-fiction book on a specific topic.',
    supportsOutline: true,
    supportsChapters: true,
    typicalPageRange: [150, 300],
    ideaPromptHint: 'Emphasize a clear unique angle/thesis and a distinct target reader problem being solved.',
  },
  educational: {
    id: 'educational',
    label: 'Educational Book',
    tier: 'high',
    description: 'A book teaching a subject in a structured, curriculum-like way.',
    supportsOutline: true,
    supportsChapters: true,
    typicalPageRange: [150, 250],
    ideaPromptHint: 'Structure content as a learning progression from foundational to advanced concepts.',
  },
  how_to_guide: {
    id: 'how_to_guide',
    label: 'How-to Guide',
    tier: 'high',
    description: 'A practical, instructional guide for accomplishing a specific outcome.',
    supportsOutline: true,
    supportsChapters: true,
    typicalPageRange: [100, 200],
    ideaPromptHint: 'Organize around sequential, actionable steps toward one clearly stated outcome.',
  },
  short_story_collection: {
    id: 'short_story_collection',
    label: 'Short Story Collection',
    tier: 'high',
    description: 'A collection of short fiction, typically united by a theme or genre.',
    supportsOutline: true,
    supportsChapters: true,
    typicalPageRange: [150, 250],
    ideaPromptHint: 'Propose a unifying theme or genre across the collection and a distinct hook per story.',
  },
};

export function getBookTypeDefinition(id: BookTypeId): BookTypeDefinition {
  return BOOK_TYPE_CATALOG[id];
}

export function listBookTypeDefinitions(): BookTypeDefinition[] {
  return Object.values(BOOK_TYPE_CATALOG);
}

export type { BookContentTier, BookTypeId, LanguageCode };
