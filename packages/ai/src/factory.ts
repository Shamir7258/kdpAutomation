import type { AppEnv } from '@kdp/config';
import type { AIProvider } from './types.js';
import { MockAIProvider } from './providers/mock-provider.js';
import { ClaudeAIProvider } from './providers/claude-provider.js';
import { OpenAIAIProvider } from './providers/openai-provider.js';

/**
 * Selects the AI provider from config.AI_PROVIDER. A misconfigured real
 * provider (selected but missing its API key) fails loudly here, at
 * startup/first-use, rather than silently falling back to a mock — per
 * §50, "no fake implementations of core functionality."
 */
export function createAIProvider(config: Pick<AppEnv, 'AI_PROVIDER' | 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY' | 'AI_MODEL'>): AIProvider {
  switch (config.AI_PROVIDER) {
    case 'claude': {
      if (!config.ANTHROPIC_API_KEY) {
        throw new Error('AI_PROVIDER=claude requires ANTHROPIC_API_KEY to be set.');
      }
      return new ClaudeAIProvider({ apiKey: config.ANTHROPIC_API_KEY, defaultModel: config.AI_MODEL });
    }
    case 'openai': {
      if (!config.OPENAI_API_KEY) {
        throw new Error('AI_PROVIDER=openai requires OPENAI_API_KEY to be set.');
      }
      return new OpenAIAIProvider({ apiKey: config.OPENAI_API_KEY, defaultModel: config.AI_MODEL });
    }
    case 'mock':
      return new MockAIProvider();
    default: {
      const exhaustive: never = config.AI_PROVIDER;
      throw new Error(`Unknown AI_PROVIDER: ${String(exhaustive)}`);
    }
  }
}
