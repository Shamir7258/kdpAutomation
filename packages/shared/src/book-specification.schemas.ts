import { z } from 'zod';
import { READING_LEVELS, TRIM_SIZE_IDS } from './enums.js';

export const createBookSpecificationSchema = z.object({
  ideaId: z.string().min(1),
  tone: z.string().max(200).default('conversational'),
  readingLevel: z.enum(READING_LEVELS).default('general'),
  trimSizeId: z.enum(TRIM_SIZE_IDS).default('6x9'),
});
export type CreateBookSpecificationInput = z.infer<typeof createBookSpecificationSchema>;

export interface BookSpecificationDto {
  id: string;
  projectId: string;
  ideaId: string;
  workingTitle: string;
  subtitle: string;
  audience: string;
  tone: string;
  readingLevel: string;
  language: string;
  trimSizeId: string;
  estimatedPageCount: number;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
}
