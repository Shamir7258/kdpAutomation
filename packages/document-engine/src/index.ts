import { generateDocx } from './docx-generator.js';
import { generateEpub } from './epub-generator.js';
import { generatePdf } from './pdf-generator.js';
import type { BookManuscript, GeneratedInterior, InteriorFormat, InteriorOptions } from './types.js';

export type { BookManuscript, ManuscriptChapter, ManuscriptSection, GeneratedInterior, InteriorFormat, InteriorOptions } from './types.js';
export { INTERIOR_FORMATS } from './types.js';
export { parseMarkdownBlocks, type MarkdownBlock } from './markdown-blocks.js';
export { getTrimSizeInches, type TrimSizeInches } from './trim-sizes.js';

export async function generateInterior(
  format: InteriorFormat,
  manuscript: BookManuscript,
  options: InteriorOptions,
): Promise<GeneratedInterior> {
  switch (format) {
    case 'pdf':
      return generatePdf(manuscript, options);
    case 'docx':
      return generateDocx(manuscript, options);
    case 'epub':
      return generateEpub(manuscript, options);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unknown interior format: ${String(exhaustive)}`);
    }
  }
}
