import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { BaseAIProvider } from '../base-provider.js';
import type { AIGenerateOptions, AIStructuredResult, AITextResult } from '../types.js';

const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_MAX_TOKENS = 4096;

export interface OpenAIProviderConfig {
  apiKey: string;
  defaultModel?: string;
}

/** Wraps the OpenAI Chat Completions API. Structured output uses the SDK's zod-based `.parse()` helper (Structured Outputs). */
export class OpenAIAIProvider extends BaseAIProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: OpenAIProviderConfig) {
    super();
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  }

  async generateText(prompt: string, options?: AIGenerateOptions): Promise<AITextResult> {
    const response = await this.client.chat.completions.create({
      model: options?.model ?? this.defaultModel,
      max_completion_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
      messages: [
        ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
    });

    const choice = response.choices[0];
    if (!choice?.message.content) {
      throw new Error('OpenAI returned an empty response.');
    }

    return {
      text: choice.message.content,
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async generateStructuredData<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<T>> {
    const response = await this.client.chat.completions.parse({
      model: options?.model ?? this.defaultModel,
      max_completion_tokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options?.temperature,
      messages: [
        ...(options?.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
        { role: 'user' as const, content: prompt },
      ],
      response_format: zodResponseFormat(schema, 'result'),
    });

    const choice = response.choices[0];
    if (!choice?.message.parsed) {
      throw new Error('OpenAI response did not match the expected structured output schema.');
    }

    return {
      data: choice.message.parsed,
      model: response.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }
}
