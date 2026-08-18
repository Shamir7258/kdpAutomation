import { describe, expect, it } from 'vitest';
import { generateInterior } from './index.js';
import type { BookManuscript, InteriorOptions } from './types.js';

const manuscript: BookManuscript = {
  title: 'Deep Work for Beginners',
  subtitle: 'A practical guide to remote productivity',
  authorName: 'Jane Publisher',
  chapters: [
    {
      title: 'Getting Started',
      sections: [
        {
          title: 'Why Focus Matters',
          content:
            '# Why Focus Matters\n\nThis is the first paragraph with **bold** text.\n\n- One\n- Two\n- Three\n\n> A quoted insight.',
        },
        {
          title: 'Setting Up Your Environment',
          content: '1. First step\n2. Second step\n\nSome closing thoughts.',
        },
      ],
    },
    {
      title: 'Building Habits',
      sections: [{ title: 'Daily Rituals', content: 'A short section about rituals.' }],
    },
  ],
};

const options: InteriorOptions = { trimSizeId: '6x9', includeTableOfContents: true };

describe('generateInterior', () => {
  it('generates a valid PDF (starts with the %PDF- magic bytes)', async () => {
    const result = await generateInterior('pdf', manuscript, options);
    expect(result.contentType).toBe('application/pdf');
    expect(result.fileExtension).toBe('pdf');
    expect(result.data.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(result.data.byteLength).toBeGreaterThan(1000);
  });

  it('generates a valid DOCX (a ZIP archive, starts with the PK magic bytes)', async () => {
    const result = await generateInterior('docx', manuscript, options);
    expect(result.fileExtension).toBe('docx');
    expect(result.data.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  it('generates a valid EPUB (a ZIP archive, starts with the PK magic bytes)', async () => {
    const result = await generateInterior('epub', manuscript, options);
    expect(result.fileExtension).toBe('epub');
    expect(result.data.subarray(0, 2).toString('ascii')).toBe('PK');
  });

  it('rejects an unknown format', async () => {
    // @ts-expect-error deliberately invalid format to verify the runtime guard
    await expect(generateInterior('rtf', manuscript, options)).rejects.toThrow(/Unknown interior format/);
  });
});
