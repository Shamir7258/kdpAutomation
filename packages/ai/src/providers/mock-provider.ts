import type { z } from 'zod';
import { BaseAIProvider } from '../base-provider.js';
import type { AIGenerateOptions, AIStructuredResult, AITextResult } from '../types.js';

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

/**
 * Builds a placeholder value that satisfies a given zod schema's shape, by
 * walking its `_def`. Covers the handful of zod primitives our own schemas
 * use (object/array/string/number/boolean/enum/optional/default/union) —
 * not a general-purpose zod-to-mock library, just enough to keep the mock
 * provider schema-agnostic so it doesn't need per-call-site special-casing.
 */
function mockValueForSchema(schema: z.ZodTypeAny): unknown {
  const def = (schema as unknown as { _def: { typeName: string; [k: string]: unknown } })._def;
  switch (def.typeName) {
    case 'ZodObject': {
      const shape = (def.shape as () => Record<string, z.ZodTypeAny>)();
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        result[key] = mockValueForSchema(shape[key]!);
      }
      return result;
    }
    case 'ZodArray':
      return [mockValueForSchema(def.type as z.ZodTypeAny)];
    case 'ZodString':
      return 'Mock generated text';
    case 'ZodNumber':
      return 1;
    case 'ZodBoolean':
      return true;
    case 'ZodEnum':
      return (def.values as string[])[0];
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
      return mockValueForSchema(def.innerType as z.ZodTypeAny);
    case 'ZodUnion':
      return mockValueForSchema((def.options as z.ZodTypeAny[])[0]!);
    default:
      return null;
  }
}

/**
 * Deterministic, network-free provider. Default in dev/test (AI_PROVIDER=mock)
 * so the app is fully runnable and testable without API keys — per §40/§51,
 * "do not make tests dependent on paid AI APIs."
 */
export class MockAIProvider extends BaseAIProvider {
  readonly name = 'mock';

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<AITextResult> {
    const text = `[mock response to ${prompt.length}-char prompt]`;
    return {
      text,
      model: options?.model ?? 'mock-model',
      usage: { inputTokens: estimateTokens(prompt), outputTokens: estimateTokens(text) },
    };
  }

  async generateStructuredData<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<T>> {
    const data = schema.parse(mockValueForSchema(schema));
    return {
      data,
      model: options?.model ?? 'mock-model',
      usage: { inputTokens: estimateTokens(prompt), outputTokens: 32 },
    };
  }
}
