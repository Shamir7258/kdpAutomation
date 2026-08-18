import { z } from 'zod';

/** Mirrors PAPER_TYPES in @kdp/cover-engine (duplicated, not imported — cover-engine is a
 *  backend-only package, same reasoning as interior.schemas.ts's INTERIOR_FORMATS). */
export const PAPER_TYPES = ['white', 'cream', 'color'] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export const generateCoverSchema = z.object({
  paperType: z.enum(PAPER_TYPES).default('white'),
  /** Optional extra art direction appended to the auto-built cover prompt (genre/mood/imagery). */
  stylePrompt: z.string().trim().max(500).optional(),
});
export type GenerateCoverInput = z.infer<typeof generateCoverSchema>;

export interface CoverDto {
  id: string;
  projectId: string;
  batchId: string;
  paperType: PaperType;
  pageCount: number;
  spineWidthIn: number;
  ebookCoverUrl: string;
  wrapCoverPdfUrl: string;
  createdAt: string;
}
