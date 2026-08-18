import type { z } from 'zod';
import {
  contentAnalysisSchema,
  generatedMetadataSchema,
  generatedOutlineSchema,
} from './schemas.js';
import type {
  AIGenerateOptions,
  AIProvider,
  AIStructuredResult,
  AITextResult,
  ContentAnalysis,
  GeneratedMetadata,
  GeneratedOutline,
} from './types.js';

/**
 * Implements the domain-specific AIProvider methods on top of the two
 * primitives every concrete provider must supply. This is where prompt
 * shaping for outline/content/metadata/analysis generation lives — once,
 * not duplicated per provider (§51 DRY).
 */
export abstract class BaseAIProvider implements AIProvider {
  abstract readonly name: string;

  abstract generateText(prompt: string, options?: AIGenerateOptions): Promise<AITextResult>;

  abstract generateStructuredData<T>(
    prompt: string,
    schema: z.ZodType<T>,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<T>>;

  async generateOutline(
    bookContext: string,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<GeneratedOutline>> {
    const prompt = [
      'Generate a hierarchical chapter/section outline for the following book.',
      'Each chapter needs a title, a one-paragraph summary, and 2-5 sections, each with its own title and summary.',
      '',
      bookContext,
    ].join('\n');
    return this.generateStructuredData(prompt, generatedOutlineSchema, {
      systemPrompt: 'You are an expert book editor and outline architect.',
      ...options,
    });
  }

  async generateBookContent(sectionContext: string, options?: AIGenerateOptions): Promise<AITextResult> {
    const prompt = [
      'Write the full content for the following book section. Match the tone, reading level, and',
      'formatting rules described. Output only the section content — no meta-commentary.',
      '',
      sectionContext,
    ].join('\n');
    return this.generateText(prompt, {
      systemPrompt: 'You are a professional book author ghostwriting on behalf of the platform user.',
      ...options,
    });
  }

  async editContent(content: string, instruction: string, options?: AIGenerateOptions): Promise<AITextResult> {
    const prompt = [
      `Editing instruction: ${instruction}`,
      '',
      'Content to edit:',
      content,
      '',
      'Return only the edited content, with no explanation.',
    ].join('\n');
    return this.generateText(prompt, {
      systemPrompt: 'You are a meticulous professional book editor.',
      ...options,
    });
  }

  async analyzeContent(
    content: string,
    analysisType: string,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<ContentAnalysis>> {
    const prompt = [
      `Perform a "${analysisType}" analysis of the following content.`,
      'Return a summary and a list of specific findings, each with a type, description, and severity.',
      'Do not fabricate issues — if the content is clean, return an empty findings list.',
      '',
      content,
    ].join('\n');
    return this.generateStructuredData(prompt, contentAnalysisSchema, {
      systemPrompt: 'You are a rigorous editorial quality reviewer. You never fabricate findings.',
      ...options,
    });
  }

  async generateMetadata(
    bookContext: string,
    options?: AIGenerateOptions,
  ): Promise<AIStructuredResult<GeneratedMetadata>> {
    const prompt = [
      'Generate KDP metadata suggestions for the following book: several title options, subtitle',
      'options, one description, keyword candidates, and category candidates. These are suggestions',
      'for the human publisher to review and edit — do not claim they guarantee sales or ranking.',
      '',
      bookContext,
    ].join('\n');
    return this.generateStructuredData(prompt, generatedMetadataSchema, {
      systemPrompt: 'You are a KDP publishing metadata specialist.',
      ...options,
    });
  }

  generatePrompt(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      Object.prototype.hasOwnProperty.call(variables, key) ? variables[key]! : match,
    );
  }
}
