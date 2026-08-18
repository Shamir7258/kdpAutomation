import sharp from 'sharp';
import type { GeneratedImage, ImageGenerateOptions, ImageProvider } from '../image-types.js';

function hashToColor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

/** Deterministic, no-network placeholder — same purpose as MockAIProvider: a solid-color
 *  rectangle (color derived from the prompt, so different prompts are visually distinguishable
 *  in dev/test without calling a paid image API) with the prompt text overlaid. */
export class MockImageProvider implements ImageProvider {
  readonly name = 'mock';

  async generateImage(prompt: string, options?: ImageGenerateOptions): Promise<GeneratedImage> {
    const [width, height] = (options?.size ?? '1024x1536').split('x').map(Number) as [number, number];
    const color = hashToColor(prompt);
    const label = prompt.slice(0, 60).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${color}" />
        <text x="50%" y="50%" font-size="${Math.round(width / 20)}" fill="white" text-anchor="middle"
              font-family="sans-serif" dominant-baseline="middle">
          [mock cover: ${label}]
        </text>
      </svg>`;

    const data = await sharp(Buffer.from(svg)).png().toBuffer();
    return { data, contentType: 'image/png' };
  }
}
