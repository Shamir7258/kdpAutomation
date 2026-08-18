export type FindingSeverity = 'error' | 'warning';
export type FindingCategory = 'metadata' | 'content' | 'interior' | 'cover';

export interface ValidationFinding {
  ruleId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  message: string;
}

export interface ValidationContext {
  bookType: { supportsOutline: boolean };
  specification: { trimSizeId: string; estimatedPageCount: number } | null;
  outline: { totalSections: number; sectionsWithContent: number };
  metadata: {
    title: string;
    description: string;
    keywords: string[];
    categories: string[];
    authorName: string;
  } | null;
  interiors: { format: string; trimSizeId: string; pageCount?: number }[];
  /** Newest first — rules that only care about "the latest cover" read `covers[0]`. */
  covers: { paperType: string; pageCount: number }[];
}

/** A configurable rule (§ "configurable rules" in the Phase 9 brief) — the registry below is the
 *  extension point: register() adds a rule, runValidation() runs every registered rule against a
 *  snapshot of one project's current state. Each `check` is a pure function (no I/O) so rules stay
 *  independently unit-testable and the registry itself never touches the database. */
export interface ValidationRule {
  id: string;
  label: string;
  category: FindingCategory;
  check(context: ValidationContext): ValidationFinding[];
}
