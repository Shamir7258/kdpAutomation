import OpenAI from 'openai';
import type { GeneratedImage, ImageGenerateOptions, ImageProvider } from '../image-types.js';

const DEFAULT_MODEL = 'gpt-image-1';
const DEFAULT_SIZE = '1024x1536'; // portrait, close to KDP's recommended front-cover aspect ratio

export interface OpenAIImageProviderConfig {
  apiKey: string;
  defaultModel?: string;
}

/** Wraps OpenAI's Images API (gpt-image-1). Requests base64-encoded output directly — no
 *  intermediate URL fetch, and no reliance on the 60-minute expiring URLs some models return. */
export class OpenAIImageProvider implements ImageProvider {
  readonly name = 'openai';
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(config: OpenAIImageProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
  }

  async generateImage(prompt: string, options?: ImageGenerateOptions): Promise<GeneratedImage> {
    const response = await this.client.images.generate({
      model: options?.model ?? this.defaultModel,
      prompt,
      size: options?.size ?? DEFAULT_SIZE,
      n: 1,
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      throw new Error('OpenAI image generation returned no image data.');
    }
    return { data: Buffer.from(b64, 'base64'), contentType: 'image/png' };
  }
}
