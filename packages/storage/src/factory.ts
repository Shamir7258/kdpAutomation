import type { AppEnv } from '@kdp/config';
import { LocalStorageProvider } from './local-storage-provider.js';
import { S3StorageProvider } from './s3-storage-provider.js';
import type { StorageProvider } from './types.js';

type StorageConfig = Pick<
  AppEnv,
  'STORAGE_PROVIDER' | 'STORAGE_LOCAL_ROOT' | 'AWS_S3_BUCKET' | 'AWS_REGION' | 'AWS_S3_ENDPOINT' | 'AWS_ACCESS_KEY_ID' | 'AWS_SECRET_ACCESS_KEY'
>;

/** Selects the storage provider from config.STORAGE_PROVIDER. A misconfigured real provider
 *  (s3 without a bucket/region) fails fast here, not on the first upload. */
export function createStorageProvider(config: StorageConfig): StorageProvider {
  switch (config.STORAGE_PROVIDER) {
    case 'local':
      return new LocalStorageProvider(config.STORAGE_LOCAL_ROOT);
    case 's3': {
      if (!config.AWS_S3_BUCKET || !config.AWS_REGION) {
        throw new Error('STORAGE_PROVIDER=s3 requires AWS_S3_BUCKET and AWS_REGION to be set.');
      }
      return new S3StorageProvider({
        bucket: config.AWS_S3_BUCKET,
        region: config.AWS_REGION,
        endpoint: config.AWS_S3_ENDPOINT,
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      });
    }
    default: {
      const exhaustive: never = config.STORAGE_PROVIDER;
      throw new Error(`Unknown STORAGE_PROVIDER: ${String(exhaustive)}`);
    }
  }
}
