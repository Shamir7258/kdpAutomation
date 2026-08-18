import { z } from 'zod';

/** Maps directly to the example actions in §35 of the brief. */
export const ASSISTANT_ACTIONS = [
  'rewrite',
  'simplify',
  'age_appropriate',
  'alternatives',
  'expand',
  'shorten',
  'improve',
  'exercises',
  'questions',
  'fact_check',
  'custom',
] as const;
export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

export const assistantRequestSchema = z.object({
  action: z.enum(ASSISTANT_ACTIONS),
  /** Operates on this text if provided (the editor selection); falls back to the section's whole current content. */
  selectedText: z.string().trim().max(20_000).optional(),
  /** Required for `custom`; ignored otherwise. */
  instruction: z.string().trim().max(2000).optional(),
  /** Required for `age_appropriate`, e.g. "8-12". */
  ageRange: z.string().trim().max(50).optional(),
  /** For `alternatives`. */
  count: z.coerce.number().int().min(2).max(5).default(3),
});
export type AssistantRequestInput = z.infer<typeof assistantRequestSchema>;

export interface AssistantFinding {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
}

export type AssistantResult =
  | { kind: 'text'; text: string }
  | { kind: 'alternatives'; alternatives: string[] }
  | { kind: 'analysis'; summary: string; findings: AssistantFinding[] };
