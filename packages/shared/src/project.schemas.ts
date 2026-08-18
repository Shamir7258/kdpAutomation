import { z } from 'zod';
import { BOOK_TYPE_IDS, LANGUAGES, PROJECT_STATUSES } from './enums.js';

/**
 * `z.coerce.boolean()` runs values through JS `Boolean(...)`, so the
 * *string* "false" (as sent in a query string, e.g. `?includeArchived=false`)
 * coerces to `true` — any non-empty string is truthy. This accepts an
 * actual boolean (JSON body) or the literal strings "true"/"false" (query
 * string) and only those.
 */
const booleanQueryParam = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .default(defaultValue)
    .transform((v) => (typeof v === 'boolean' ? v : v === 'true'));

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(200),
  bookType: z.enum(BOOK_TYPE_IDS),
  niche: z.string().trim().min(1).max(300),
  targetAudience: z.string().trim().max(300).default(''),
  language: z.enum(LANGUAGES).default('en'),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  niche: z.string().trim().min(1).max(300).optional(),
  targetAudience: z.string().trim().max(300).optional(),
  language: z.enum(LANGUAGES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listProjectsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  bookType: z.enum(BOOK_TYPE_IDS).optional(),
  includeArchived: booleanQueryParam(false),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('updatedAt'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;

export interface ProjectDto {
  id: string;
  userId: string;
  organizationId: string | null;
  name: string;
  bookType: string;
  niche: string;
  targetAudience: string;
  language: string;
  status: string;
  workflowStatus: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}
