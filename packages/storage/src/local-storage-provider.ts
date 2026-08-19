import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, normalize, resolve, sep } from 'node:path';
import type { StorageProvider, StoredFile } from './types.js';

/** Dev-only fallback — writes to local disk, served back through the backend's own
 *  `/api/files/*` route (see apps/backend). Production deployments should use
 *  S3StorageProvider, which serves presigned URLs directly from the object store instead
 *  of proxying bytes through the API process. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  constructor(private readonly rootDir: string) {}

  private resolvePath(key: string): string {
    const root = resolve(this.rootDir);
    const resolved = resolve(root, normalize(key));
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      throw new Error(`Refusing to write outside the storage root: ${key}`);
    }
    return resolved;
  }

  async save(key: string, data: Buffer, _contentType: string): Promise<StoredFile> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    return { key, url: `/api/files/${key}`, sizeBytes: data.byteLength };
  }

  async getUrl(key: string): Promise<string> {
    return `/api/files/${key}`;
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolvePath(key), { force: true });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  /** Local-only convenience, not part of the StorageProvider interface — used by the backend's
   *  file-serving route to 404 cleanly instead of attempting a read that would throw. */
  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.resolvePath(key));
      return true;
    } catch {
      return false;
    }
  }
}
