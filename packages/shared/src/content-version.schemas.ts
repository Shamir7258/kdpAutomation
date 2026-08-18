export const CONTENT_VERSION_SOURCES = ['ai_generated', 'manual_edit'] as const;
export type ContentVersionSource = (typeof CONTENT_VERSION_SOURCES)[number];

export interface ContentVersionDto {
  id: string;
  sectionId: string;
  versionNumber: number;
  content: string;
  source: ContentVersionSource;
  createdAt: string;
}

export interface SectionContentDto {
  sectionId: string;
  currentVersionNumber: number | null;
  currentContent: string | null;
  versionCount: number;
}
