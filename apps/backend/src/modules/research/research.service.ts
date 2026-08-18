import type { GenerateResearchInput, ResearchDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { requireBookType } from '../book-types/book-type.registry.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { getResearchProvider } from './research-provider.instance.js';
import { ResearchModel, type ResearchDocument } from './research.model.js';

function toDto(doc: ResearchDocument): ResearchDto {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    nicheSummary: doc.nicheSummary,
    audience: doc.audience,
    potentialTopics: doc.potentialTopics,
    potentialSubtopics: doc.potentialSubtopics,
    searchTerms: doc.searchTerms,
    competitorThemes: doc.competitorThemes,
    contentOpportunities: doc.contentOpportunities,
    differentiationOpportunities: doc.differentiationOpportunities,
    riskWarnings: doc.riskWarnings,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const researchService = {
  async generate(userId: string, projectId: string, input: GenerateResearchInput): Promise<ResearchDto> {
    const project = await projectService.getById(userId, projectId);
    const bookType = requireBookType(project.bookType as Parameters<typeof requireBookType>[0]);
    const provider = getResearchProvider();
    const aiProviderName = getAIProvider().name;

    const query = {
      niche: project.niche,
      targetAudience: project.targetAudience,
      language: project.language,
      marketplace: input.marketplace,
      bookTypeLabel: bookType.label,
    };

    const searchResult = await provider.search(query);
    await aiUsageService.record({ userId, projectId, provider: aiProviderName, operation: 'research_search', result: searchResult });

    const analysisResult = await provider.analyze(query, searchResult.data);
    await aiUsageService.record({ userId, projectId, provider: aiProviderName, operation: 'research_analyze', result: analysisResult });

    const insights = await provider.generateInsights(analysisResult.data);

    const doc = await ResearchModel.create({ projectId, userId, ...insights });

    const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
    if (projectDoc) {
      projectDoc.workflowStatus.set('RESEARCH', 'completed');
      await projectDoc.save();
    }

    return toDto(doc);
  },

  async list(userId: string, projectId: string): Promise<ResearchDto[]> {
    await projectService.getById(userId, projectId); // ownership check
    const docs = await ResearchModel.find({ projectId, userId }).sort({ createdAt: -1 });
    return docs.map(toDto);
  },

  async getLatest(userId: string, projectId: string): Promise<ResearchDto> {
    await projectService.getById(userId, projectId);
    const doc = await ResearchModel.findOne({ projectId, userId }).sort({ createdAt: -1 });
    if (!doc) {
      throw AppError.notFound('No research has been generated for this project yet.');
    }
    return toDto(doc);
  },
};
