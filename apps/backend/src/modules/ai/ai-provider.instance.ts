import { createAIProvider, type AIProvider } from '@kdp/ai';
import { loadConfig } from '@kdp/config';

let cached: AIProvider | undefined;

/** Lazily constructs the configured AIProvider once per process. Reads AI_PROVIDER/keys from config — see @kdp/ai/factory for the selection + fail-fast rules. */
export function getAIProvider(): AIProvider {
  if (!cached) {
    cached = createAIProvider(loadConfig());
  }
  return cached;
}

/** Test-only escape hatch to inject a mock/fake provider or force a fresh instance after changing env. */
export function setAIProviderForTesting(provider: AIProvider | undefined): void {
  cached = provider;
}
