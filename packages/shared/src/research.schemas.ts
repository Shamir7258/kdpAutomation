import { z } from 'zod';

export const generateResearchSchema = z.object({
  marketplace: z.string().trim().max(100).default('amazon.com'),
});
export type GenerateResearchInput = z.infer<typeof generateResearchSchema>;

export interface ResearchDto {
  id: string;
  projectId: string;
  nicheSummary: string;
  audience: string;
  potentialTopics: string[];
  potentialSubtopics: string[];
  searchTerms: string[];
  competitorThemes: string[];
  contentOpportunities: string[];
  differentiationOpportunities: string[];
  riskWarnings: string[];
  createdAt: string;
}
