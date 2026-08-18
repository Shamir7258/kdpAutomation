import Anthropic from '@anthropic-ai/sdk';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { BaseAIProvider } from '../base-provider.js';
import type { AIGenerateOptions, AIStructuredResult, AITextResult } from '../types.js';

const DEFAULT_MODEL = 'claude-opus-5';
const DEFAULT_MAX_TOKENS = 4096;

export interface ClaudeProviderConfig {
  apiKey: string;
  defaultModel?: string;
}

/**
 * Wraps the Anthropic Messages API. Structured output uses
 * `output_config.format` (a JSON Schema derived from the zod schema via
 * zod-to-json-schema) rather than the SDK's own `zodOutputFormat()` helper —
 * that helper's types require zod v4, while this monorepo standardizes on
 * zod v3 everywhere else (shared DTOs, backend validation, RHF resolvers).
 * The response is parsed and validated with the *same* zod v3 schema the
 * caller passed in, so the result is still fully typed — this only forgoes
 * the SDK's own runtime auto-parse convenience. System prompts get a
 * cache_control breakpoint since the same system prompt (per prompt
 * template) is reused across many calls (e.g. every idea-generation request
 * for a given book type).
 */
export class ClaudeAIProvider extends BaseAIProvider {
  readonly name = 'claude';
  private readonly client: Anthropic;
  private readonly defaultModel: string;

  constructor(config: ClaudeProviderConfig) {
    super();
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<AITextResult> {
    const response = await this.client.messages.create({
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: options?.systemPrompt
        ? [{ type: 'text', text: options.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude declined to generate this content (safety classifier refusal).');
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    return {
      text,
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }

  async generateStructuredData<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<T>> {
    const jsonSchema = zodToJsonSchema(schema, 'result');

    const response = await this.client.messages.create({
      model: options?.model ?? this.defaultModel,
      max_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: options?.systemPrompt
        ? [{ type: 'text', text: options.systemPrompt, cache_control: { type: 'ephemeral' } }]
        : undefined,
      messages: [{ role: 'user', content: prompt }],
      output_config: { format: { type: 'json_schema', schema: jsonSchema as Record<string, unknown> } },
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('Claude declined to generate this content (safety classifier refusal).');
    }

    const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
    if (!textBlock) {
      throw new Error('Claude returned no text content for a structured-output request.');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(textBlock.text);
    } catch {
      throw new Error('Claude did not return valid JSON for the requested schema.');
    }

    return {
      data: schema.parse(parsedJson),
      model: response.model,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    };
  }
}
