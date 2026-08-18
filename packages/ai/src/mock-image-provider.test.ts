import { describe, expect, it } from 'vitest';
import { MockImageProvider } from './providers/mock-image-provider.js';
import { createImageProvider } from './image-factory.js';

describe('MockImageProvider', () => {
  const provider = new MockImageProvider();

  it('generates a valid PNG (starts with the PNG magic bytes)', async () => {
    const result = await provider.generateImage('A cover for a fitness journal');
    expect(result.contentType).toBe('image/png');
    expect(result.data.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it('respects the requested size', async () => {
    const tall = await provider.generateImage('A cover', { size: '1024x1536' });
    const square = await provider.generateImage('A cover', { size: '1024x1024' });
    // A taller image has strictly more pixels, so its (uncompressed-ish) PNG is larger.
    expect(tall.data.byteLength).toBeGreaterThan(square.data.byteLength);
  });

  it('is deterministic for the same prompt', async () => {
    const a = await provider.generateImage('The Focused Founder');
    const b = await provider.generateImage('The Focused Founder');
    expect(a.data).toEqual(b.data);
  });
});

describe('createImageProvider', () => {
  it('returns a MockImageProvider by default', () => {
    const provider = createImageProvider({ IMAGE_PROVIDER: 'mock', OPENAI_API_KEY: undefined });
    expect(provider.name).toBe('mock');
  });

  it('fails fast when IMAGE_PROVIDER=openai is missing an API key', () => {
    expect(() => createImageProvider({ IMAGE_PROVIDER: 'openai', OPENAI_API_KEY: undefined })).toThrow(/OPENAI_API_KEY/);
  });
});
