import { createImageProvider, type ImageProvider } from '@kdp/ai';
import { loadConfig } from '@kdp/config';

let cached: ImageProvider | undefined;

/** Lazily constructs the configured ImageProvider once per process — same pattern as
 *  ai-provider.instance.ts. Reads IMAGE_PROVIDER/OPENAI_API_KEY from config. */
export function getImageProvider(): ImageProvider {
  if (!cached) {
    cached = createImageProvider(loadConfig());
  }
  return cached;
}

/** Test-only escape hatch, same purpose as setAIProviderForTesting. */
export function setImageProviderForTesting(provider: ImageProvider | undefined): void {
  cached = provider;
}
