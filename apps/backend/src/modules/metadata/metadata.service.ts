import type { MetadataDto, UpdateMetadataInput } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { MetadataModel, type MetadataDocument } from './metadata.model.js';

function toDto(doc: MetadataDocument): MetadataDto {
  return {
    id: doc._id.toString(),
    projectId: doc.projectId.toString(),
    title: doc.title,
    subtitle: doc.subtitle,
    seriesName: doc.seriesName,
    seriesNumber: doc.seriesNumber ?? undefined,
    description: doc.description,
    keywords: doc.keywords,
    categories: doc.categories,
    authorName: doc.authorName,
    primaryMarketplace: doc.primaryMarketplace,
    pricing: doc.pricing ? { currency: doc.pricing.currency ?? 'USD', listPrice: doc.pricing.listPrice ?? 0 } : undefined,
    aiSuggestions: doc.aiSuggestions,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function buildBookContext(userId: string, projectId: string): Promise<string> {
  const project = await projectService.getById(userId, projectId);
  const spec = await bookSpecificationService.getByProject(userId, projectId);
  const chapters = await ChapterModel.find({ projectId, userId }).sort({ order: 1 });
  return [
    `Working title: ${spec.workingTitle}`,
    `Subtitle: ${spec.subtitle}`,
    `Niche: ${project.niche}`,
    `Audience: ${spec.audience}`,
    `Tone: ${spec.tone}`,
    `Reading level: ${spec.readingLevel}`,
    `Language: ${project.language}`,
    chapters.length > 0 ? `Chapter titles: ${chapters.map((c) => c.title).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const metadataService = {
  /** Generates fresh AI suggestions. Creates the doc on first call, overwrites suggestions + re-seeds
   *  the editable fields on subsequent calls (metadata is a single current draft, not versioned history
   *  like book content — the publisher's PATCH edits are the thing that needs preserving, not each draft). */
  async generate(userId: string, projectId: string): Promise<MetadataDto> {
    await projectService.getById(userId, projectId); // ownership check

    const context = await buildBookContext(userId, projectId);
    const provider = getAIProvider();
    const result = await provider.generateMetadata(context);
    await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'metadata_generation', result });

    const suggestions = result.data;
    const update = {
      title: suggestions.titles[0] ?? '',
      subtitle: suggestions.subtitles[0] ?? '',
      description: suggestions.description,
      keywords: suggestions.keywords.slice(0, 7),
      categories: suggestions.categories.slice(0, 2),
      aiSuggestions: suggestions,
    };

    const doc = await MetadataModel.findOneAndUpdate({ projectId, userId }, { $set: update }, { upsert: true, new: true });

    const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
    if (projectDoc) {
      projectDoc.workflowStatus.set('METADATA', 'completed');
      await projectDoc.save();
    }

    return toDto(doc!);
  },

  async getByProject(userId: string, projectId: string): Promise<MetadataDto> {
    await projectService.getById(userId, projectId); // ownership check
    const doc = await MetadataModel.findOne({ projectId, userId });
    if (!doc) {
      throw AppError.notFound('This project does not have metadata yet.');
    }
    return toDto(doc);
  },

  async update(userId: string, projectId: string, input: UpdateMetadataInput): Promise<MetadataDto> {
    await projectService.getById(userId, projectId); // ownership check
    const doc = await MetadataModel.findOne({ projectId, userId });
    if (!doc) {
      throw AppError.notFound('This project does not have metadata yet — generate it first.');
    }
    Object.assign(doc, input);
    await doc.save();
    return toDto(doc);
  },
};
