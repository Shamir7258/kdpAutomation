import sharp from 'sharp';
import type { CoverInput } from './types.js';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Composites title/subtitle/author text onto the AI-generated artwork — a semi-transparent
 * band across the lower third for legibility over any background. This is the image KDP's
 * eBook listing shows (front cover only, no spine/back — Kindle has no concept of either), and
 * it's reused as the wrap cover's front panel too, so both formats show the same design.
 */
export async function compositeTitleOntoImage(input: CoverInput): Promise<Buffer> {
  const meta = await sharp(input.frontImage).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1536;

  const titleSize = Math.round(width * 0.08);
  const subtitleSize = Math.round(width * 0.035);
  const authorSize = Math.round(width * 0.04);
  const bandTop = Math.round(height * 0.68);

  const lines = [
    `<rect x="0" y="${bandTop}" width="${width}" height="${height - bandTop}" fill="black" fill-opacity="0.55" />`,
    `<text x="50%" y="${bandTop + titleSize * 1.3}" font-size="${titleSize}" fill="white" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="bold">${escapeXml(input.title)}</text>`,
  ];
  if (input.subtitle) {
    lines.push(
      `<text x="50%" y="${bandTop + titleSize * 1.3 + subtitleSize * 1.6}" font-size="${subtitleSize}" fill="white" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">${escapeXml(input.subtitle)}</text>`,
    );
  }
  if (input.authorName) {
    lines.push(
      `<text x="50%" y="${height - authorSize}" font-size="${authorSize}" fill="white" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif">${escapeXml(input.authorName)}</text>`,
    );
  }

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines.join('')}</svg>`;

  return sharp(input.frontImage)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
