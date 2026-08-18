import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageProvider } from './local-storage-provider.js';
import { createStorageProvider } from './factory.js';

let root: string;
let provider: LocalStorageProvider;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'kdp-storage-test-'));
  provider = new LocalStorageProvider(root);
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('LocalStorageProvider', () => {
  it('saves a file under nested keys and can read it back from disk', async () => {
    const data = Buffer.from('hello world');
    const result = await provider.save('interiors/user1/project1/book.pdf', data, 'application/pdf');

    expect(result.key).toBe('interiors/user1/project1/book.pdf');
    expect(result.url).toBe('/api/files/interiors/user1/project1/book.pdf');
    expect(result.sizeBytes).toBe(data.byteLength);

    const onDisk = await readFile(join(root, 'interiors/user1/project1/book.pdf'));
    expect(onDisk.toString()).toBe('hello world');
  });

  it('read() returns the exact bytes previously saved', async () => {
    const data = Buffer.from([1, 2, 3, 4, 5]);
    await provider.save('a/b.bin', data, 'application/octet-stream');
    const readBack = await provider.read('a/b.bin');
    expect(readBack).toEqual(data);
  });

  it('exists() reflects whether the key is present', async () => {
    expect(await provider.exists('missing.txt')).toBe(false);
    await provider.save('present.txt', Buffer.from('x'), 'text/plain');
    expect(await provider.exists('present.txt')).toBe(true);
  });

  it('delete() removes the file', async () => {
    await provider.save('to-delete.txt', Buffer.from('x'), 'text/plain');
    await provider.delete('to-delete.txt');
    expect(await provider.exists('to-delete.txt')).toBe(false);
  });

  it('refuses to write outside the storage root via a path-traversal key', async () => {
    await expect(provider.save('../../etc/passwd', Buffer.from('x'), 'text/plain')).rejects.toThrow(/outside/);
  });
});

describe('createStorageProvider', () => {
  it('returns a LocalStorageProvider by default', () => {
    const p = createStorageProvider({
      STORAGE_PROVIDER: 'local',
      STORAGE_LOCAL_ROOT: root,
      AWS_S3_BUCKET: undefined,
      AWS_REGION: undefined,
      AWS_S3_ENDPOINT: undefined,
      AWS_ACCESS_KEY_ID: undefined,
      AWS_SECRET_ACCESS_KEY: undefined,
    });
    expect(p.name).toBe('local');
  });

  it('fails fast when STORAGE_PROVIDER=s3 is missing bucket/region', () => {
    expect(() =>
      createStorageProvider({
        STORAGE_PROVIDER: 's3',
        STORAGE_LOCAL_ROOT: root,
        AWS_S3_BUCKET: undefined,
        AWS_REGION: undefined,
        AWS_S3_ENDPOINT: undefined,
        AWS_ACCESS_KEY_ID: undefined,
        AWS_SECRET_ACCESS_KEY: undefined,
      }),
    ).toThrow(/AWS_S3_BUCKET/);
  });

  it('constructs an S3StorageProvider when config is complete', () => {
    const p = createStorageProvider({
      STORAGE_PROVIDER: 's3',
      STORAGE_LOCAL_ROOT: root,
      AWS_S3_BUCKET: 'my-bucket',
      AWS_REGION: 'us-east-1',
      AWS_S3_ENDPOINT: undefined,
      AWS_ACCESS_KEY_ID: undefined,
      AWS_SECRET_ACCESS_KEY: undefined,
    });
    expect(p.name).toBe('s3');
  });
});
