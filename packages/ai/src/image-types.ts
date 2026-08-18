export interface ImageGenerateOptions {
  model?: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
}

export interface GeneratedImage {
  data: Buffer;
  contentType: string;
}

/**
 * Provider-agnostic image-generation surface, parallel to AIProvider (§8)
 * but for cover art rather than text. Kept as a separate interface (not a
 * method on AIProvider) since not every AIProvider implementation can
 * generate images — Claude has no image-generation endpoint.
 */
export interface ImageProvider {
  readonly name: string;
  generateImage(prompt: string, options?: ImageGenerateOptions): Promise<GeneratedImage>;
}
