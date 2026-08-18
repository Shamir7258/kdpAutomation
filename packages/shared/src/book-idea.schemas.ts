import { z } from 'zod';

export const bookIdeaContentSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  targetAudience: z.string(),
  problemSolved: z.string(),
  uniqueAngle: z.string(),
  estimatedPageCount: z.number(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  contentType: z.string(),
  differentiation: z.string(),
  potentialRisks: z.array(z.string()),
});
export type BookIdeaContent = z.infer<typeof bookIdeaContentSchema>;

export const bookIdeaListSchema = z.object({ ideas: z.array(bookIdeaContentSchema) });
export type BookIdeaList = z.infer<typeof bookIdeaListSchema>;

export const generateIdeasSchema = z.object({
  count: z.coerce.number().int().min(1).max(10).default(5),
});
export type GenerateIdeasInput = z.infer<typeof generateIdeasSchema>;

export const BOOK_IDEA_STATUSES = ['proposed', 'saved', 'rejected'] as const;
export type BookIdeaStatus = (typeof BOOK_IDEA_STATUSES)[number];

export interface BookIdeaDto extends BookIdeaContent {
  id: string;
  projectId: string;
  status: BookIdeaStatus;
  createdAt: string;
}
