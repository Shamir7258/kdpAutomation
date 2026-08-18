import type { AppEnv } from '@kdp/config';
import type { ImageProvider } from './image-types.js';
import { MockImageProvider } from './providers/mock-image-provider.js';
import { OpenAIImageProvider } from './providers/openai-image-provider.js';

/** Mirrors createAIProvider's selection/fail-fast pattern, for IMAGE_PROVIDER instead. */
export function createImageProvider(config: Pick<AppEnv, 'IMAGE_PROVIDER' | 'OPENAI_API_KEY'>): ImageProvider {
  switch (config.IMAGE_PROVIDER) {
    case 'openai': {
      if (!config.OPENAI_API_KEY) {
        throw new Error('IMAGE_PROVIDER=openai requires OPENAI_API_KEY to be set.');
      }
      return new OpenAIImageProvider({ apiKey: config.OPENAI_API_KEY });
    }
    case 'mock':
      return new MockImageProvider();
    default: {
      const exhaustive: never = config.IMAGE_PROVIDER;
      throw new Error(`Unknown IMAGE_PROVIDER: ${String(exhaustive)}`);
    }
  }
}
