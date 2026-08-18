import { z } from 'zod';
import { TRIM_SIZE_IDS } from './enums.js';

/** Mirrors INTERIOR_FORMATS in @kdp/document-engine (duplicated, not imported — document-engine
 *  is a backend-only package with Node-specific dependencies and isn't meant to reach the frontend
 *  bundle, same reasoning document-engine uses for not importing TRIM_SIZE_IDS from here). */
export const INTERIOR_FORMATS = ['pdf', 'epub', 'docx'] as const;
export type InteriorFormat = (typeof INTERIOR_FORMATS)[number];

export const generateInteriorSchema = z.object({
  format: z.enum(INTERIOR_FORMATS),
  trimSizeId: z.enum(TRIM_SIZE_IDS).optional(),
});
export type GenerateInteriorInput = z.infer<typeof generateInteriorSchema>;

export interface InteriorDto {
  id: string;
  projectId: string;
  batchId: string;
  format: InteriorFormat;
  trimSizeId: string;
  url: string;
  fileSizeBytes: number;
  createdAt: string;
}
