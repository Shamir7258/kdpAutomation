import { describe, expect, it } from 'vitest';
import { generateCover } from './index.js';
import type { CoverInput } from './types.js';

// A minimal valid 1x1 red-pixel PNG — a real, well-known test fixture (not the AI provider's
// concern here; generateCover just needs *some* valid image bytes to embed).
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

const baseInput: CoverInput = {
  title: 'Deep Work for Remote Workers',
  subtitle: 'Focus without an office',
  authorName: 'Jane Publisher',
  trimSizeId: '6x9',
  pageCount: 180,
  paperType: 'white',
  frontImage: TINY_PNG,
  backCoverBlurb: 'A practical guide to staying focused while working from anywhere.',
};

describe('generateCover', () => {
  it('produces an eBook cover with the title composited onto the artwork (not a bare passthrough)', async () => {
    const result = await generateCover(baseInput);
    expect(result.ebookCoverContentType).toBe('image/png');
    expect(result.ebookCover).not.toEqual(TINY_PNG);
    expect(result.ebookCover.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  });

  it('produces a valid wrap-cover PDF (starts with the %PDF- magic bytes)', async () => {
    const result = await generateCover(baseInput);
    expect(result.wrapCoverPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.wrapCoverPdf.byteLength).toBeGreaterThan(500);
  });

  it('reports a spine width consistent with the real KDP formula', async () => {
    const result = await generateCover(baseInput);
    expect(result.spineWidthIn).toBeCloseTo(180 * 0.002252, 3);
  });

  it('still produces a valid PDF for a very thin book (blank/no spine text path)', async () => {
    const result = await generateCover({ ...baseInput, pageCount: 24 });
    expect(result.wrapCoverPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.spineWidthIn).toBeLessThan(0.0625);
  });

  it('still produces a valid PDF with no subtitle/author/blurb', async () => {
    const result = await generateCover({
      title: 'Minimal Cover',
      trimSizeId: '5x8',
      pageCount: 60,
      paperType: 'cream',
      frontImage: TINY_PNG,
    });
    expect(result.wrapCoverPdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
