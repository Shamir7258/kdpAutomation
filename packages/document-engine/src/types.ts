export interface ManuscriptSection {
  title: string;
  /** Markdown — the canonical content storage format used throughout the platform (§ ARCHITECTURE.md §3). */
  content: string;
}

export interface ManuscriptChapter {
  title: string;
  sections: ManuscriptSection[];
}

export interface BookManuscript {
  title: string;
  subtitle?: string;
  authorName?: string;
  chapters: ManuscriptChapter[];
}

export const INTERIOR_FORMATS = ['pdf', 'epub', 'docx'] as const;
export type InteriorFormat = (typeof INTERIOR_FORMATS)[number];

export interface InteriorOptions {
  trimSizeId: string;
  includeTableOfContents?: boolean;
}

export interface GeneratedInterior {
  data: Buffer;
  contentType: string;
  fileExtension: string;
  /** Actual rendered page count — only meaningful for paginated formats (PDF). Reflowable
   *  formats (EPUB) have no fixed page count; DOCX's true page count depends on the reader's
   *  renderer/font substitution, so it's left undefined rather than reporting a guess. */
  pageCount?: number;
}
