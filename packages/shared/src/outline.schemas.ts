import { z } from 'zod';

export const createChapterSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(2000).default(''),
});
export type CreateChapterInput = z.infer<typeof createChapterSchema>;

export const updateChapterSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().trim().max(2000).optional(),
});
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;

export const reorderChaptersSchema = z.object({
  chapterIds: z.array(z.string()).min(1),
});
export type ReorderChaptersInput = z.infer<typeof reorderChaptersSchema>;

export const createSectionSchema = z.object({
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(2000).default(''),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const updateSectionSchema = updateChapterSchema;
export type UpdateSectionInput = z.infer<typeof updateSectionSchema>;

export const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.string()).min(1),
});
export type ReorderSectionsInput = z.infer<typeof reorderSectionsSchema>;

export interface SectionDto {
  id: string;
  chapterId: string;
  projectId: string;
  title: string;
  summary: string;
  order: number;
}

export interface ChapterDto {
  id: string;
  projectId: string;
  title: string;
  summary: string;
  order: number;
  sections: SectionDto[];
}
