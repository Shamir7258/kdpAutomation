import { z } from 'zod';
import type { AIProvider, AIStructuredResult } from '@kdp/ai';
import type {
  ResearchAnalysis,
  ResearchInsights,
  ResearchProvider,
  ResearchQuery,
  ResearchSearchResult,
} from '../research-provider.js';

const searchResultSchema = z.object({
  candidateTopics: z.array(z.string()),
  candidateSearchTerms: z.array(z.string()),
  competitorPatternNotes: z.string(),
});

const analysisSchema = z.object({
  nicheSummary: z.string(),
  audience: z.string(),
  potentialTopics: z.array(z.string()),
  potentialSubtopics: z.array(z.string()),
  searchTerms: z.array(z.string()),
  competitorThemes: z.array(z.string()),
  contentOpportunities: z.array(z.string()),
  differentiationOpportunities: z.array(z.string()),
  riskWarnings: z.array(z.string()),
});

function describeQuery(query: ResearchQuery): string {
  return [
    `Niche: ${query.niche}`,
    `Book type: ${query.bookTypeLabel}`,
    `Target audience: ${query.targetAudience || 'not specified — infer a sensible one'}`,
    `Language: ${query.language}`,
    `Marketplace: ${query.marketplace}`,
  ].join('\n');
}

/**
 * The only ResearchProvider implementation today. Synthesizes findings from
 * the underlying AIProvider's training knowledge — never scrapes Amazon or
 * any live source (§7's explicit prohibition). Two AI calls: `search()`
 * brainstorms raw candidate topics/terms/competitor patterns, `analyze()`
 * structures them into the final insight categories. `generateInsights()`
 * is an identity pass here — the seam exists so a future multi-source
 * provider (real search results from several APIs) has somewhere to
 * combine/finalize before storage.
 */
export class AIResearchProvider implements ResearchProvider {
  constructor(private readonly ai: AIProvider) {}

  async search(query: ResearchQuery): Promise<AIStructuredResult<ResearchSearchResult>> {
    const prompt = [
      'Brainstorm raw research inputs for a KDP book in this niche. Do not fabricate specific competitor',
      'book titles, authors, sales figures, or reviews — describe competitor content in terms of general',
      'THEMES and PATTERNS you are aware of for this kind of niche, not invented specifics.',
      '',
      describeQuery(query),
    ].join('\n');

    return this.ai.generateStructuredData(prompt, searchResultSchema, {
      systemPrompt:
        'You are a KDP market research assistant. You synthesize general knowledge, never fabricated ' +
        'specifics presented as facts, and you never claim to have live/current marketplace data.',
    });
  }

  async analyze(
    query: ResearchQuery,
    results: ResearchSearchResult,
  ): Promise<AIStructuredResult<ResearchAnalysis>> {
    const prompt = [
      'Structure the following raw research into a niche research report for a KDP book.',
      'riskWarnings must be realistic content/legal/market risks for this niche — if genuinely low-risk,',
      'say so explicitly rather than leaving it empty. Do not guarantee sales, rankings, or demand.',
      '',
      describeQuery(query),
      '',
      `Candidate topics: ${results.candidateTopics.join(', ')}`,
      `Candidate search terms: ${results.candidateSearchTerms.join(', ')}`,
      `Competitor pattern notes: ${results.competitorPatternNotes}`,
    ].join('\n');

    return this.ai.generateStructuredData(prompt, analysisSchema, {
      systemPrompt: 'You are a KDP market research analyst producing a structured niche report.',
    });
  }

  async generateInsights(analysis: ResearchAnalysis): Promise<ResearchInsights> {
    return analysis;
  }
}
