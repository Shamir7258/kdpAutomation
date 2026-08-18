import { compositeTitleOntoImage } from './ebook-cover.js';
import { generateWrapCover } from './wrap-cover.js';
import type { CoverInput, GeneratedCover } from './types.js';

export type { CoverInput, GeneratedCover } from './types.js';
export { PAPER_TYPES, type PaperType, calculateSpineWidthInches, MIN_SPINE_WIDTH_FOR_TEXT_IN } from './spine.js';
export { getTrimSizeInches, type TrimSizeInches } from './trim-sizes.js';

/** KDP's eBook cover slot only ever shows the front — no spine, no back. Title/subtitle/author
 *  text is composited onto the AI-generated artwork once, and that same finished image is used
 *  both as the eBook cover and as the wrap cover's front panel, so the two formats match. */
export async function generateCover(input: CoverInput): Promise<GeneratedCover> {
  const ebookCover = await compositeTitleOntoImage(input);
  const { data: wrapCoverPdf, spineWidthIn } = await generateWrapCover({ ...input, frontImage: ebookCover });
  return {
    ebookCover,
    ebookCoverContentType: 'image/png',
    wrapCoverPdf,
    spineWidthIn,
  };
}
