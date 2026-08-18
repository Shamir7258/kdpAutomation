import { z } from 'zod';

/**
 * Real, publicly documented KDP publishing constraints (not fabricated):
 * up to 7 keyword phrases (50 chars each), a ~4000-char description limit.
 * Categories are free text, not validated against a live/scraped Amazon
 * taxonomy — Amazon's category list is large and changes over time, and
 * this platform never scrapes Amazon (§7).
 */
export const metadataFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().max(200).default(''),
  seriesName: z.string().trim().max(200).default(''),
  seriesNumber: z.coerce.number().int().positive().optional(),
  description: z.string().trim().min(1).max(4000),
  keywords: z.array(z.string().trim().min(1).max(50)).max(7).default([]),
  categories: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  authorName: z.string().trim().max(200).default(''),
  primaryMarketplace: z.string().trim().max(50).default('amazon.com'),
  pricing: z
    .object({
      currency: z.string().trim().length(3).default('USD'),
      listPrice: z.coerce.number().positive(),
    })
    .optional(),
});

export const updateMetadataSchema = metadataFieldsSchema.partial();
export type UpdateMetadataInput = z.infer<typeof updateMetadataSchema>;

export interface MetadataAiSuggestionsDto {
  titles: string[];
  subtitles: string[];
  description: string;
  keywords: string[];
  categories: string[];
}

export interface MetadataDto {
  id: string;
  projectId: string;
  title: string;
  subtitle: string;
  seriesName: string;
  seriesNumber?: number;
  description: string;
  keywords: string[];
  categories: string[];
  authorName: string;
  primaryMarketplace: string;
  pricing?: { currency: string; listPrice: number };
  aiSuggestions: MetadataAiSuggestionsDto;
  createdAt: string;
  updatedAt: string;
}
