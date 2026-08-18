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
}
