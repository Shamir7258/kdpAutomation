import { z } from 'zod';
import { ROLES } from './enums.js';

// ---- Users ----

export interface AdminUserDto {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  disabled: boolean;
  projectCount: number;
  createdAt: string;
}

export const updateUserSchema = z.object({
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---- Prompt templates ----

export interface PromptTemplateDto {
  id: string;
  name: string;
  version: number;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createPromptTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  systemPrompt: z.string().trim().min(1),
  userPrompt: z.string().trim().min(1),
  variables: z.array(z.string().trim().min(1)).default([]),
});
export type CreatePromptTemplateInput = z.infer<typeof createPromptTemplateSchema>;

export const updatePromptTemplateSchema = z.object({
  description: z.string().trim().max(1000).optional(),
  systemPrompt: z.string().trim().min(1).optional(),
  userPrompt: z.string().trim().min(1).optional(),
  variables: z.array(z.string().trim().min(1)).optional(),
  active: z.boolean().optional(),
});
export type UpdatePromptTemplateInput = z.infer<typeof updatePromptTemplateSchema>;

// ---- Validation rules (read-only listing of @kdp/kdp-validator's registry) ----

export interface ValidationRuleDto {
  id: string;
  label: string;
  category: string;
}

// ---- System info (hand-picked safe fields only — never the raw env/config object) ----

export interface SystemInfoDto {
  nodeEnv: string;
  aiProvider: string;
  imageProvider: string;
  storageProvider: string;
  aiUsage: { totalCostUsd: number; totalCalls: number };
}
