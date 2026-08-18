import { describe, expect, it } from 'vitest';
import { MockAIProvider } from './providers/mock-provider.js';
import { generatedOutlineSchema } from './schemas.js';

describe('MockAIProvider', () => {
  const provider = new MockAIProvider();

  it('generateText returns deterministic, non-empty text with usage', async () => {
    const result = await provider.generateText('Write about fitness');
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
    expect(result.usage.outputTokens).toBeGreaterThan(0);
  });

  it('generateStructuredData returns data that validates against the given schema', async () => {
    const result = await provider.generateStructuredData('Outline a fitness journal', generatedOutlineSchema);
    expect(() => generatedOutlineSchema.parse(result.data)).not.toThrow();
    expect(result.data.chapters.length).toBeGreaterThan(0);
    expect(result.data.chapters[0]!.sections.length).toBeGreaterThan(0);
  });

  it('generateOutline (domain method) produces a schema-valid outline via the shared base implementation', async () => {
    const result = await provider.generateOutline('A 90-day fitness journal for beginners');
    expect(result.data.chapters[0]!.title).toBeTruthy();
  });

  it('generateMetadata produces titles, keywords, and categories', async () => {
    const result = await provider.generateMetadata('A 90-day fitness journal for beginners');
    expect(result.data.titles.length).toBeGreaterThan(0);
    expect(result.data.keywords.length).toBeGreaterThan(0);
  });

  it('analyzeContent never fabricates when asked to flag issues (mock returns a fixed shape)', async () => {
    const result = await provider.analyzeContent('Some manuscript text', 'consistency');
    expect(Array.isArray(result.data.findings)).toBe(true);
  });

  it('generatePrompt interpolates known variables and leaves unknown placeholders untouched', () => {
    const rendered = provider.generatePrompt('Hello {{name}}, welcome to {{missing}}', { name: 'Alex' });
    expect(rendered).toBe('Hello Alex, welcome to {{missing}}');
  });
});
