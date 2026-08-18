import type { TokenUsage } from './types.js';

interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

/**
 * List-price USD-per-million-token rates, current as of 2026-08-18.
 * Verified against Anthropic's published model table and OpenAI's pricing
 * page — not guessed. These are for cost *estimation* in the dashboard
 * (§28); they are not a guarantee of billed cost, and should be reviewed
 * periodically (a Phase 11 admin screen is the eventual place to edit them
 * without a code change).
 */
export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Claude (Anthropic)
  'claude-opus-5': { input: 5.0, output: 25.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-opus-4-8': { input: 5.0, output: 25.0 },
  'claude-opus-4-7': { input: 5.0, output: 25.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },

  // OpenAI
  'gpt-5': { input: 1.25, output: 10.0 },
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2.0, output: 8.0 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

/** Returns null (rather than throwing) for an unrecognized model — cost tracking degrades gracefully, it never blocks a generation. */
export function estimateCostUsd(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICING[model];
  if (!price) return null;
  return (usage.inputTokens / 1_000_000) * price.input + (usage.outputTokens / 1_000_000) * price.output;
}
