import type { ResearchProvider } from './research-provider.js';
import { AIResearchProvider } from './providers/ai-research-provider.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';

/**
 * Constructed fresh per call (cheap — no network I/O happens at
 * construction) rather than cached, so it always wraps whatever
 * `getAIProvider()` currently returns — important for tests, which inject
 * a mock AIProvider via `setAIProviderForTesting()` after the module has
 * already loaded.
 */
export function getResearchProvider(): ResearchProvider {
  return new AIResearchProvider(getAIProvider());
}
