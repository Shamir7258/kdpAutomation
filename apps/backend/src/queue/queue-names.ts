/**
 * The full queue set from §27 of the brief. Only `CONTENT_GENERATION` has a
 * live Queue/Worker pair today (Phase 4) — the rest are named here so every
 * later phase that adds a queue uses the same constant instead of a
 * hand-typed string, but a Queue object isn't created until its phase
 * actually adds a Worker to consume it (an unconsumed Queue is dead
 * infrastructure, not a head start).
 */
export const QUEUE_NAMES = {
  RESEARCH: 'research',
  AI_GENERATION: 'ai-generation',
  CONTENT_GENERATION: 'content-generation',
  EDITING: 'editing',
  IMAGE_GENERATION: 'image-generation',
  DOCUMENT_GENERATION: 'document-generation',
  COVER_GENERATION: 'cover-generation',
  VALIDATION: 'validation',
  EXPORT: 'export',
} as const;
