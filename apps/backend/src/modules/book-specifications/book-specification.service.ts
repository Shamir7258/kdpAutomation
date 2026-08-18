import type { BookSpecificationDto, CreateBookSpecificationInput } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { requireBookType } from '../book-types/book-type.registry.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { BookIdeaModel } from '../book-ideas/book-idea.model.js';
import { BookSpecificationModel, type BookSpecificationDocument } from './book-specification.model.js';

function toDto(spec: BookSpecificationDocument): BookSpecificationDto {
  return {
    id: spec._id.toString(),
    projectId: spec.projectId.toString(),
    ideaId: spec.ideaId.toString(),
    workingTitle: spec.workingTitle,
    subtitle: spec.subtitle,
    audience: spec.audience,
    tone: spec.tone,
    readingLevel: spec.readingLevel,
    language: spec.language,
    trimSizeId: spec.trimSizeId,
    estimatedPageCount: spec.estimatedPageCount,
    chapterCount: spec.chapterCount,
    createdAt: spec.createdAt.toISOString(),
    updatedAt: spec.updatedAt.toISOString(),
  };
}

export const bookSpecificationService = {
  /** Creates the project's one canonical spec from a selected idea. Marks the idea "saved" and advances the workflow. */
  async createFromIdea(
    userId: string,
    projectId: string,
    input: CreateBookSpecificationInput,
  ): Promise<BookSpecificationDto> {
    const project = await projectService.getById(userId, projectId);

    const existing = await BookSpecificationModel.findOne({ projectId, userId });
    if (existing) {
      throw AppError.conflict('This project already has a specification. Delete/rename the project to start over.');
    }

    const idea = await BookIdeaModel.findOne({ _id: input.ideaId, projectId, userId });
    if (!idea) {
      throw AppError.notFound('Book idea not found.');
    }

    const bookType = requireBookType(project.bookType as Parameters<typeof requireBookType>[0]);

    const spec = await BookSpecificationModel.create({
      projectId,
      userId,
      ideaId: idea._id,
      workingTitle: idea.title,
      subtitle: idea.subtitle,
      audience: idea.targetAudience,
      tone: input.tone,
      readingLevel: input.readingLevel,
      language: project.language,
      trimSizeId: input.trimSizeId,
      estimatedPageCount: idea.estimatedPageCount || bookType.typicalPageRange[0],
      chapterCount: bookType.supportsChapters ? Math.max(3, Math.round(idea.estimatedPageCount / 25)) : 0,
    });

    idea.status = 'saved';
    await idea.save();

    const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
    if (projectDoc) {
      projectDoc.workflowStatus.set('SPECIFICATION', 'completed');
      await projectDoc.save();
    }

    return toDto(spec);
  },

  async getByProject(userId: string, projectId: string): Promise<BookSpecificationDto> {
    await projectService.getById(userId, projectId); // ownership check
    const spec = await BookSpecificationModel.findOne({ projectId, userId });
    if (!spec) {
      throw AppError.notFound('This project does not have a specification yet.');
    }
    return toDto(spec);
  },
};
