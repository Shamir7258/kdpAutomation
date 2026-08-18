import type { z } from 'zod';

export interface AIGenerateOptions {
  /** Overrides the provider's configured default model for this call. */
  model?: string;
  /** 0-1. Ignored by providers/models that don't expose sampling controls (e.g. Claude 4+). */
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AITextResult {
  text: string;
  model: string;
  usage: TokenUsage;
}

export interface AIStructuredResult<T> {
  data: T;
  model: string;
  usage: TokenUsage;
}

export interface OutlineSection {
  title: string;
  summary: string;
}

export interface OutlineChapter {
  title: string;
  summary: string;
  sections: OutlineSection[];
}

export interface GeneratedOutline {
  chapters: OutlineChapter[];
}

export interface ContentAnalysisFinding {
  type: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  location?: string;
}

export interface ContentAnalysis {
  summary: string;
  findings: ContentAnalysisFinding[];
}

export interface GeneratedMetadata {
  titles: string[];
  subtitles: string[];
  description: string;
  keywords: string[];
  categories: string[];
}

/**
 * Provider-agnostic AI capability surface (§8 of the brief). Concrete
 * providers (Claude, OpenAI, Mock) implement the two primitives
 * (generateText, generateStructuredData); the domain-specific methods have
 * shared default implementations in BaseAIProvider built on top of those
 * primitives, so no provider duplicates prompt-shaping logic.
 */
export interface AIProvider {
  readonly name: string;

  generateText(prompt: string, options?: AIGenerateOptions): Promise<AITextResult>;

  generateStructuredData<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<T>>;

  generateOutline(bookContext: string, options?: AIGenerateOptions): Promise<AIStructuredResult<GeneratedOutline>>;

  generateBookContent(sectionContext: string, options?: AIGenerateOptions): Promise<AITextResult>;

  editContent(content: string, instruction: string, options?: AIGenerateOptions): Promise<AITextResult>;

  analyzeContent(
    content: string,
    analysisType: string,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<ContentAnalysis>>;

  generateMetadata(bookContext: string, options?: AIGenerateOptions): Promise<AIStructuredResult<GeneratedMetadata>>;

  /** Pure template interpolation — no AI call. Replaces `{{variable}}` placeholders. */
  generatePrompt(template: string, variables: Record<string, string>): string;
}
