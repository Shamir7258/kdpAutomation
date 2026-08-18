import { z } from 'zod';

export const outlineSectionSchema = z.object({
  title: z.string(),
  summary: z.string(),
});

export const outlineChapterSchema = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.array(outlineSectionSchema),
});

export const generatedOutlineSchema = z.object({
  chapters: z.array(outlineChapterSchema),
});

export const contentAnalysisFindingSchema = z.object({
  type: z.string(),
  description: z.string(),
  severity: z.enum(['low', 'medium', 'high']),
  location: z.string().optional(),
});

export const contentAnalysisSchema = z.object({
  summary: z.string(),
  findings: z.array(contentAnalysisFindingSchema),
});

export const generatedMetadataSchema = z.object({
  titles: z.array(z.string()),
  subtitles: z.array(z.string()),
  description: z.string(),
  keywords: z.array(z.string()),
  categories: z.array(z.string()),
});
