import type { PaperType } from './spine.js';

export interface CoverInput {
  title: string;
  subtitle?: string;
  authorName?: string;
  trimSizeId: string;
  pageCount: number;
  paperType: PaperType;
  /** The AI-generated (or otherwise supplied) front-cover artwork — any format `sharp` can
   *  decode (source format is auto-detected; every output from this package is PNG). */
  frontImage: Buffer;
  /** Hex color for the spine and back-cover background. Defaults to a neutral dark navy. */
  spineColor?: string;
  backCoverBlurb?: string;
}

export interface GeneratedCover {
  /** The front-cover image alone, suitable for the Kindle eBook listing — KDP's eBook cover
   *  slot only ever shows the front, never a full wrap. */
  ebookCover: Buffer;
  ebookCoverContentType: string;
  /** The full front+spine+back wrap, as a print-ready PDF sized to the trim size + real KDP
   *  spine width + 0.125" bleed on every outer edge. */
  wrapCoverPdf: Buffer;
  spineWidthIn: number;
}
