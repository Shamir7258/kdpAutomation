import { outlineChapterSchema, outlineSectionSchema } from '@kdp/ai';
import type {
  ChapterDto,
  CreateChapterInput,
  CreateSectionInput,
  ReorderChaptersInput,
  ReorderSectionsInput,
  SectionDto,
  UpdateChapterInput,
  UpdateSectionInput,
} from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { requireBookType } from '../book-types/book-type.registry.js';
import { projectService } from '../projects/project.service.js';
import { ProjectModel } from '../projects/project.model.js';
import { bookSpecificationService } from '../book-specifications/book-specification.service.js';
import { ChapterModel, type ChapterDocument } from './chapter.model.js';
import { SectionModel, type SectionDocument } from './section.model.js';

function toSectionDto(section: SectionDocument): SectionDto {
  return {
    id: section._id.toString(),
    chapterId: section.chapterId.toString(),
    projectId: section.projectId.toString(),
    title: section.title,
    summary: section.summary,
    order: section.order,
  };
}

function toChapterDto(chapter: ChapterDocument, sections: SectionDocument[]): ChapterDto {
  return {
    id: chapter._id.toString(),
    projectId: chapter.projectId.toString(),
    title: chapter.title,
    summary: chapter.summary,
    order: chapter.order,
    sections: sections.filter((s) => s.chapterId.toString() === chapter._id.toString()).map(toSectionDto),
  };
}

async function findOwnedChapter(userId: string, projectId: string, chapterId: string): Promise<ChapterDocument> {
  const chapter = await ChapterModel.findOne({ _id: chapterId, projectId, userId });
  if (!chapter) {
    throw AppError.notFound('Chapter not found.');
  }
  return chapter;
}

async function buildBookContext(userId: string, projectId: string): Promise<{ context: string; chapterCount: number }> {
  const project = await projectService.getById(userId, projectId);
  const spec = await bookSpecificationService.getByProject(userId, projectId);
  const context = [
    `Title: ${spec.workingTitle}`,
    `Subtitle: ${spec.subtitle}`,
    `Niche: ${project.niche}`,
    `Audience: ${spec.audience}`,
    `Tone: ${spec.tone}`,
    `Reading level: ${spec.readingLevel}`,
    `Target chapter count: ${spec.chapterCount || 'use your judgment'}`,
    `Language: ${project.language}`,
  ].join('\n');
  return { context, chapterCount: spec.chapterCount };
}

export const outlineService = {
  /** Full regenerate: replaces any existing outline. Only valid for book types that support chaptered outlines (§6). */
  async generateFull(userId: string, projectId: string): Promise<ChapterDto[]> {
    const project = await projectService.getById(userId, projectId);
    const bookType = requireBookType(project.bookType as Parameters<typeof requireBookType>[0]);
    if (!bookType.supportsOutline) {
      throw AppError.validation(`"${bookType.label}" books don't use a chaptered outline.`);
    }

    const { context } = await buildBookContext(userId, projectId);
    const provider = getAIProvider();
    const result = await provider.generateOutline(context);
    await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'outline_generation', result });

    const existingChapters = await ChapterModel.find({ projectId, userId }, { _id: 1 });
    await SectionModel.deleteMany({ chapterId: { $in: existingChapters.map((c) => c._id) } });
    await ChapterModel.deleteMany({ projectId, userId });

    const createdChapters: ChapterDocument[] = [];
    const createdSections: SectionDocument[] = [];
    for (const [chapterIndex, chapter] of result.data.chapters.entries()) {
      const chapterDoc = await ChapterModel.create({
        projectId,
        userId,
        title: chapter.title,
        summary: chapter.summary,
        order: chapterIndex,
      });
      createdChapters.push(chapterDoc);
      for (const [sectionIndex, section] of chapter.sections.entries()) {
        createdSections.push(
          await SectionModel.create({
            chapterId: chapterDoc._id,
            projectId,
            userId,
            title: section.title,
            summary: section.summary,
            order: sectionIndex,
          }),
        );
      }
    }

    const projectDoc = await ProjectModel.findOne({ _id: projectId, userId });
    if (projectDoc) {
      projectDoc.workflowStatus.set('OUTLINE', 'completed');
      await projectDoc.save();
    }

    return createdChapters.map((c) => toChapterDto(c, createdSections));
  },

  async list(userId: string, projectId: string): Promise<ChapterDto[]> {
    await projectService.getById(userId, projectId);
    const chapters = await ChapterModel.find({ projectId, userId }).sort({ order: 1 });
    const sections = await SectionModel.find({ projectId, userId }).sort({ order: 1 });
    return chapters.map((c) => toChapterDto(c, sections));
  },

  async addChapter(userId: string, projectId: string, input: CreateChapterInput): Promise<ChapterDto> {
    await projectService.getById(userId, projectId);
    const last = await ChapterModel.findOne({ projectId, userId }).sort({ order: -1 });
    const chapter = await ChapterModel.create({
      projectId,
      userId,
      title: input.title,
      summary: input.summary,
      order: (last?.order ?? -1) + 1,
    });
    return toChapterDto(chapter, []);
  },

  async updateChapter(
    userId: string,
    projectId: string,
    chapterId: string,
    input: UpdateChapterInput,
  ): Promise<ChapterDto> {
    const chapter = await findOwnedChapter(userId, projectId, chapterId);
    Object.assign(chapter, input);
    await chapter.save();
    const sections = await SectionModel.find({ chapterId }).sort({ order: 1 });
    return toChapterDto(chapter, sections);
  },

  async deleteChapter(userId: string, projectId: string, chapterId: string): Promise<void> {
    const chapter = await findOwnedChapter(userId, projectId, chapterId);
    await SectionModel.deleteMany({ chapterId: chapter._id });
    await chapter.deleteOne();
  },

  async reorderChapters(userId: string, projectId: string, input: ReorderChaptersInput): Promise<ChapterDto[]> {
    await projectService.getById(userId, projectId);
    const owned = await ChapterModel.countDocuments({ _id: { $in: input.chapterIds }, projectId, userId });
    if (owned !== input.chapterIds.length) {
      throw AppError.validation('One or more chapter ids do not belong to this project.');
    }
    await Promise.all(
      input.chapterIds.map((chapterId, index) => ChapterModel.updateOne({ _id: chapterId, projectId, userId }, { order: index })),
    );
    return outlineService.list(userId, projectId);
  },

  async regenerateChapter(userId: string, projectId: string, chapterId: string): Promise<ChapterDto> {
    const chapter = await findOwnedChapter(userId, projectId, chapterId);
    const { context } = await buildBookContext(userId, projectId);
    const provider = getAIProvider();

    const prompt = [
      'Regenerate ONE chapter (title, summary, and 2-5 sections) for this book. Keep it consistent with the',
      `rest of the book. The chapter currently covers: "${chapter.title} — ${chapter.summary}".`,
      '',
      context,
    ].join('\n');

    const result = await provider.generateStructuredData(prompt, outlineChapterSchema, {
      systemPrompt: 'You are an expert book editor and outline architect.',
    });
    await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'chapter_regeneration', result });

    chapter.title = result.data.title;
    chapter.summary = result.data.summary;
    await chapter.save();

    await SectionModel.deleteMany({ chapterId: chapter._id });
    const sections = await Promise.all(
      result.data.sections.map((section, index) =>
        SectionModel.create({ chapterId: chapter._id, projectId, userId, title: section.title, summary: section.summary, order: index }),
      ),
    );

    return toChapterDto(chapter, sections);
  },

  async addSection(userId: string, projectId: string, chapterId: string, input: CreateSectionInput): Promise<SectionDto> {
    await findOwnedChapter(userId, projectId, chapterId);
    const last = await SectionModel.findOne({ chapterId }).sort({ order: -1 });
    const section = await SectionModel.create({
      chapterId,
      projectId,
      userId,
      title: input.title,
      summary: input.summary,
      order: (last?.order ?? -1) + 1,
    });
    return toSectionDto(section);
  },

  async updateSection(
    userId: string,
    projectId: string,
    chapterId: string,
    sectionId: string,
    input: UpdateSectionInput,
  ): Promise<SectionDto> {
    await findOwnedChapter(userId, projectId, chapterId);
    const section = await SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId });
    if (!section) {
      throw AppError.notFound('Section not found.');
    }
    Object.assign(section, input);
    await section.save();
    return toSectionDto(section);
  },

  async deleteSection(userId: string, projectId: string, chapterId: string, sectionId: string): Promise<void> {
    await findOwnedChapter(userId, projectId, chapterId);
    const result = await SectionModel.deleteOne({ _id: sectionId, chapterId, projectId, userId });
    if (result.deletedCount === 0) {
      throw AppError.notFound('Section not found.');
    }
  },

  async reorderSections(
    userId: string,
    projectId: string,
    chapterId: string,
    input: ReorderSectionsInput,
  ): Promise<SectionDto[]> {
    await findOwnedChapter(userId, projectId, chapterId);
    const owned = await SectionModel.countDocuments({ _id: { $in: input.sectionIds }, chapterId, projectId, userId });
    if (owned !== input.sectionIds.length) {
      throw AppError.validation('One or more section ids do not belong to this chapter.');
    }
    await Promise.all(
      input.sectionIds.map((sectionId, index) => SectionModel.updateOne({ _id: sectionId, chapterId, userId }, { order: index })),
    );
    const sections = await SectionModel.find({ chapterId }).sort({ order: 1 });
    return sections.map(toSectionDto);
  },

  async regenerateSection(
    userId: string,
    projectId: string,
    chapterId: string,
    sectionId: string,
  ): Promise<SectionDto> {
    const chapter = await findOwnedChapter(userId, projectId, chapterId);
    const section = await SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId });
    if (!section) {
      throw AppError.notFound('Section not found.');
    }
    const { context } = await buildBookContext(userId, projectId);
    const provider = getAIProvider();

    const prompt = [
      `Regenerate ONE section (title and summary) within the chapter "${chapter.title}" (${chapter.summary}).`,
      `The section currently covers: "${section.title} — ${section.summary}".`,
      '',
      context,
    ].join('\n');

    const result = await provider.generateStructuredData(prompt, outlineSectionSchema, {
      systemPrompt: 'You are an expert book editor and outline architect.',
    });
    await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'section_regeneration', result });

    section.title = result.data.title;
    section.summary = result.data.summary;
    await section.save();
    return toSectionDto(section);
  },
};
