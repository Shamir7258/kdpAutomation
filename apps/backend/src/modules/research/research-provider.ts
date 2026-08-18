import type { AIStructuredResult } from '@kdp/ai';

export interface ResearchQuery {
  niche: string;
  targetAudience: string;
  language: string;
  marketplace: string;
  bookTypeLabel: string;
}

export interface ResearchSearchResult {
  candidateTopics: string[];
  candidateSearchTerms: string[];
  competitorPatternNotes: string;
}

export interface ResearchAnalysis {
  nicheSummary: string;
  audience: string;
  potentialTopics: string[];
  potentialSubtopics: string[];
  searchTerms: string[];
  competitorThemes: string[];
  contentOpportunities: string[];
  differentiationOpportunities: string[];
  riskWarnings: string[];
}

export type ResearchInsights = ResearchAnalysis;

/**
 * Provider abstraction for niche/market research (§7). The only
 * implementation today (`AIResearchProvider`) synthesizes findings from the
 * AI's training knowledge — it does not scrape Amazon or any live source,
 * per the brief's explicit prohibition on aggressive scraping. `search()`
 * is the seam where a future legitimate data provider (a keyword-research
 * API, a licensed marketplace-data feed) would plug in without touching
 * callers — it returns the same shape whether the data came from an LLM's
 * synthesis or a real API.
 */
export interface ResearchProvider {
  search(query: ResearchQuery): Promise<AIStructuredResult<ResearchSearchResult>>;
  analyze(query: ResearchQuery, results: ResearchSearchResult): Promise<AIStructuredResult<ResearchAnalysis>>;
  generateInsights(analysis: ResearchAnalysis): Promise<ResearchInsights>;
}
