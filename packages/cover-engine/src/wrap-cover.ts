import PDFDocument from 'pdfkit';
import { getTrimSizeInches, inchesToPoints } from './trim-sizes.js';
import { calculateSpineWidthInches, MIN_SPINE_WIDTH_FOR_TEXT_IN, type PaperType } from './spine.js';
import type { CoverInput } from './types.js';

const BLEED_IN = 0.125;
const DEFAULT_SPINE_COLOR = '#1a1a2e';

export interface WrapCoverResult {
  data: Buffer;
  spineWidthIn: number;
}

/**
 * Renders the full front+spine+back wrap as one print-ready PDF, per KDP's paperback cover
 * template convention: a single flat page sized to (2×trim width + spine width + 2×bleed) by
 * (trim height + 2×bleed), back cover on the left, spine in the middle, front cover on the right.
 * Spine text is only drawn once the spine is wide enough to hold it — very thin books ship with
 * a blank spine, matching KDP's own guidance.
 */
export async function generateWrapCover(input: CoverInput): Promise<WrapCoverResult> {
  const { widthIn: trimWidthIn, heightIn: trimHeightIn } = getTrimSizeInches(input.trimSizeId);
  const spineWidthIn = calculateSpineWidthInches(input.pageCount, input.paperType as PaperType);

  const totalWidthIn = 2 * trimWidthIn + spineWidthIn + 2 * BLEED_IN;
  const totalHeightIn = trimHeightIn + 2 * BLEED_IN;

  const doc = new PDFDocument({
    size: [inchesToPoints(totalWidthIn), inchesToPoints(totalHeightIn)],
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolvePromise) => doc.on('end', () => resolvePromise(Buffer.concat(chunks))));

  const pageHeightPt = inchesToPoints(totalHeightIn);
  const bleedPt = inchesToPoints(BLEED_IN);
  const trimWidthPt = inchesToPoints(trimWidthIn);
  const spineWidthPt = inchesToPoints(spineWidthIn);

  const spineColor = input.spineColor ?? DEFAULT_SPINE_COLOR;
  const backLeftEdge = 0;
  const backWidth = bleedPt + trimWidthPt;
  const spineLeftEdge = backWidth;
  const frontLeftEdge = spineLeftEdge + spineWidthPt;
  const frontWidth = trimWidthPt + bleedPt;

  // Back cover background + optional blurb, kept inside the trim (not the bleed) for safety.
  doc.rect(backLeftEdge, 0, backWidth, pageHeightPt).fill(spineColor);
  if (input.backCoverBlurb) {
    doc
      .fillColor('white')
      .font('Times-Roman')
      .fontSize(11)
      .text(input.backCoverBlurb, bleedPt + 24, bleedPt + 48, { width: backWidth - bleedPt - 48, align: 'left' });
  }

  // Spine.
  doc.rect(spineLeftEdge, 0, spineWidthPt, pageHeightPt).fill(spineColor);
  if (spineWidthIn >= MIN_SPINE_WIDTH_FOR_TEXT_IN) {
    const centerX = spineLeftEdge + spineWidthPt / 2;
    const centerY = pageHeightPt / 2;
    doc.save();
    doc.rotate(-90, { origin: [centerX, centerY] });
    doc
      .fillColor('white')
      .font('Times-Bold')
      .fontSize(Math.min(18, inchesToPoints(spineWidthIn) * 0.55))
      .text(input.title, centerX - pageHeightPt / 2, centerY - 10, { width: pageHeightPt, align: 'center' });
    if (input.authorName) {
      doc
        .font('Times-Roman')
        .fontSize(10)
        .text(input.authorName, centerX - pageHeightPt / 2, centerY + 14, { width: pageHeightPt, align: 'center' });
    }
    doc.restore();
  }

  // Front cover artwork, cropped to fill.
  doc.image(input.frontImage, frontLeftEdge, 0, { cover: [frontWidth, pageHeightPt], align: 'center', valign: 'center' });

  doc.end();
  const data = await finished;
  return { data, spineWidthIn };
}
