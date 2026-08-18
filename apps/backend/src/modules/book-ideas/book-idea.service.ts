import { bookIdeaListSchema, type BookIdeaDto, type BookIdeaStatus } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { promptTemplateService, PROMPT_TEMPLATE_NAMES } from '../prompt-templates/prompt-template.service.js';
import { requireBookType } from '../book-types/book-type.registry.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { BookIdeaModel, type BookIdeaDocument } from './book-idea.model.js';

function toDto(idea: BookIdeaDocument): BookIdeaDto {
  return {
    id: idea._id.toString(),
    projectId: idea.projectId.toString(),
    title: idea.title,
    subtitle: idea.subtitle,
    targetAudience: idea.targetAudience,
    problemSolved: idea.problemSolved,
    uniqueAngle: idea.uniqueAngle,
    estimatedPageCount: idea.estimatedPageCount,
    difficulty: idea.difficulty as BookIdeaDto['difficulty'],
    contentType: idea.contentType,
    differentiation: idea.differentiation,
    potentialRisks: idea.potentialRisks,
    status: idea.status as BookIdeaStatus,
    createdAt: idea.createdAt.toISOString(),
  };
}

export const bookIdeaService = {
  /** Generates `count` new candidate ideas via the AI provider and appends them (existing ideas are never overwritten — §10 "regenerate" adds more, it doesn't replace). */
  async generate(userId: string, projectId: string, count: number): Promise<BookIdeaDto[]> {
    const project = await projectService.getById(userId, projectId);
    const bookType = requireBookType(project.bookType as Parameters<typeof requireBookType>[0]);
    const template = await promptTemplateService.getActiveByName(PROMPT_TEMPLATE_NAMES.BOOK_IDEA_GENERATOR);

    const provider = getAIProvider();
    const userPrompt = provider.generatePrompt(template.userPrompt, {
      count: String(count),
      bookTypeLabel: bookType.label,
      bookTypeDescription: bookType.description,
      niche: project.niche,
      targetAudience: project.targetAudience || 'not specified — infer a sensible one',
      language: project.language,
      ideaPromptHint: bookType.ideaPromptHint,
    });

    const result = await provider.generateStructuredData(userPrompt, bookIdeaListSchema, {
      systemPrompt: template.systemPrompt,
    });

    await aiUsageService.record({
      userId,
      projectId,
      provider: provider.name,
      operation: 'book_idea_generation',
      result,
    });

    const created = await BookIdeaModel.insertMany(
      result.data.ideas.map((idea) => ({ ...idea, projectId, userId, status: 'proposed' })),
    );

    const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
    if (projectDoc) {
      projectDoc.workflowStatus.set('IDEA', 'completed');
      if (projectDoc.status === 'DRAFT') projectDoc.status = 'PLANNING';
      await projectDoc.save();
    }

    return (created as unknown as BookIdeaDocument[]).map(toDto);
  },

  async list(userId: string, projectId: string): Promise<BookIdeaDto[]> {
    await projectService.getById(userId, projectId); // ownership check
    const ideas = await BookIdeaModel.find({ projectId, userId }).sort({ createdAt: -1 });
    return ideas.map(toDto);
  },

  async updateStatus(userId: string, projectId: string, ideaId: string, status: BookIdeaStatus): Promise<BookIdeaDto> {
    await projectService.getById(userId, projectId); // ownership check
    const idea = await BookIdeaModel.findOne({ _id: ideaId, projectId, userId });
    if (!idea) {
      throw AppError.notFound('Book idea not found.');
    }
    idea.status = status;
    await idea.save();
    return toDto(idea);
  },
};
