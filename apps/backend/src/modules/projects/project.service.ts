import type { FilterQuery } from 'mongoose';
import type { CreateProjectInput, ListProjectsQuery, Paginated, ProjectDto, UpdateProjectInput } from '@kdp/shared';
import { WORKFLOW_STAGES } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { ProjectModel, type ProjectDocument } from './project.model.js';

function toDto(project: ProjectDocument): ProjectDto {
  return {
    id: project._id.toString(),
    userId: project.userId.toString(),
    organizationId: project.organizationId ? project.organizationId.toString() : null,
    name: project.name,
    bookType: project.bookType,
    niche: project.niche,
    targetAudience: project.targetAudience,
    language: project.language,
    status: project.status,
    workflowStatus: Object.fromEntries(project.workflowStatus as Map<string, string>),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
  };
}

async function findOwned(projectId: string, userId: string): Promise<ProjectDocument> {
  const project = await ProjectModel.findOne({ _id: projectId, userId, deletedAt: null });
  if (!project) {
    throw new AppError('PROJECT_NOT_FOUND', 'Project not found.', 404);
  }
  return project;
}

export const projectService = {
  async create(userId: string, input: CreateProjectInput): Promise<ProjectDto> {
    const project = await ProjectModel.create({
      userId,
      name: input.name,
      bookType: input.bookType,
      niche: input.niche,
      targetAudience: input.targetAudience,
      language: input.language,
    });
    return toDto(project);
  },

  async list(userId: string, query: ListProjectsQuery): Promise<Paginated<ProjectDto>> {
    const filter: FilterQuery<ProjectDocument> = { userId, deletedAt: null };
    if (!query.includeArchived) {
      filter.archivedAt = null;
    }
    if (query.status) filter.status = query.status;
    if (query.bookType) filter.bookType = query.bookType;
    if (query.search) filter.$text = { $search: query.search };

    const sort: Record<string, 1 | -1> = { [query.sortBy]: query.sortDir === 'asc' ? 1 : -1 };
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      ProjectModel.find(filter).sort(sort).skip(skip).limit(query.pageSize),
      ProjectModel.countDocuments(filter),
    ]);

    return { items: items.map(toDto), total, page: query.page, pageSize: query.pageSize };
  },

  async getById(userId: string, projectId: string): Promise<ProjectDto> {
    return toDto(await findOwned(projectId, userId));
  },

  async update(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectDto> {
    const project = await findOwned(projectId, userId);
    Object.assign(project, input);
    await project.save();
    return toDto(project);
  },

  async duplicate(userId: string, projectId: string): Promise<ProjectDto> {
    const source = await findOwned(projectId, userId);
    const copy = await ProjectModel.create({
      userId,
      name: `${source.name} (Copy)`,
      bookType: source.bookType,
      niche: source.niche,
      targetAudience: source.targetAudience,
      language: source.language,
      workflowStatus: new Map(WORKFLOW_STAGES.map((stage) => [stage, 'pending'])),
    });
    return toDto(copy);
  },

  async archive(userId: string, projectId: string): Promise<ProjectDto> {
    const project = await findOwned(projectId, userId);
    project.archivedAt = new Date();
    project.status = 'ARCHIVED';
    await project.save();
    return toDto(project);
  },

  /** Clears whichever of archivedAt/deletedAt is set, returning the project to active status. Pairs with both archive() and softDelete(). */
  async restore(userId: string, projectId: string): Promise<ProjectDto> {
    const project = await ProjectModel.findOne({ _id: projectId, userId });
    if (!project) {
      throw new AppError('PROJECT_NOT_FOUND', 'Project not found.', 404);
    }
    project.archivedAt = null;
    project.deletedAt = null;
    if (project.status === 'ARCHIVED') project.status = 'DRAFT';
    await project.save();
    return toDto(project);
  },

  /** Soft delete: the project is hidden from all normal queries but retained (and restorable) for audit/retention purposes. */
  async softDelete(userId: string, projectId: string): Promise<void> {
    const project = await findOwned(projectId, userId);
    project.deletedAt = new Date();
    await project.save();
  },
};
