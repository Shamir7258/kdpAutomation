import { createStorageProvider, type StorageProvider } from '@kdp/storage';
import { loadConfig } from '@kdp/config';

let cached: StorageProvider | undefined;

/** Lazily constructs the configured StorageProvider once per process — same pattern as
 *  ai-provider.instance.ts. Reads STORAGE_PROVIDER/keys from config. */
export function getStorageProvider(): StorageProvider {
  if (!cached) {
    cached = createStorageProvider(loadConfig());
  }
  return cached;
}

/** Test-only escape hatch, same purpose as setAIProviderForTesting. */
export function setStorageProviderForTesting(provider: StorageProvider | undefined): void {
  cached = provider;
}
