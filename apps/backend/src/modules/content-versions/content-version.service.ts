import type { ContentVersionDto, ContentVersionSource, SectionContentDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { SectionModel, type SectionDocument } from '../outline/section.model.js';
import { ContentVersionModel, type ContentVersionDocument } from './content-version.model.js';

function toDto(version: ContentVersionDocument): ContentVersionDto {
  return {
    id: version._id.toString(),
    sectionId: version.sectionId.toString(),
    versionNumber: version.versionNumber,
    content: version.content,
    source: version.source as ContentVersionSource,
    createdAt: version.createdAt.toISOString(),
  };
}

export async function findOwnedSection(
  userId: string,
  projectId: string,
  chapterId: string,
  sectionId: string,
): Promise<SectionDocument> {
  const section = await SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId });
  if (!section) {
    throw AppError.notFound('Section not found.');
  }
  return section;
}

export const contentVersionService = {
  /** Appends a new version (never overwrites) and makes it current. Used only by the content-generation job processor and, from Phase 5, manual edits. */
  async createVersion(input: {
    userId: string;
    projectId: string;
    chapterId: string;
    sectionId: string;
    content: string;
    source: ContentVersionSource;
  }): Promise<ContentVersionDto> {
    const section = await SectionModel.findOne({ _id: input.sectionId, chapterId: input.chapterId, projectId: input.projectId });
    if (!section) {
      throw AppError.notFound('Section not found.');
    }
    const nextVersionNumber = section.currentVersion + 1;
    const version = await ContentVersionModel.create({
      sectionId: input.sectionId,
      chapterId: input.chapterId,
      projectId: input.projectId,
      userId: input.userId,
      versionNumber: nextVersionNumber,
      content: input.content,
      source: input.source,
    });
    section.currentVersion = nextVersionNumber;
    await section.save();
    return toDto(version);
  },

  async listVersions(userId: string, projectId: string, chapterId: string, sectionId: string): Promise<ContentVersionDto[]> {
    await findOwnedSection(userId, projectId, chapterId, sectionId);
    const versions = await ContentVersionModel.find({ sectionId }).sort({ versionNumber: -1 });
    return versions.map(toDto);
  },

  async getCurrent(userId: string, projectId: string, chapterId: string, sectionId: string): Promise<SectionContentDto> {
    const section = await findOwnedSection(userId, projectId, chapterId, sectionId);
    const [current, versionCount] = await Promise.all([
      section.currentVersion > 0
        ? ContentVersionModel.findOne({ sectionId, versionNumber: section.currentVersion })
        : null,
      ContentVersionModel.countDocuments({ sectionId }),
    ]);
    return {
      sectionId,
      currentVersionNumber: section.currentVersion > 0 ? section.currentVersion : null,
      currentContent: current?.content ?? null,
      versionCount,
    };
  },

  /** Moves the "current" pointer to an older version. Nothing is deleted — a later "restore" back to the newest version is always possible. */
  async restore(
    userId: string,
    projectId: string,
    chapterId: string,
    sectionId: string,
    versionNumber: number,
  ): Promise<SectionContentDto> {
    const section = await findOwnedSection(userId, projectId, chapterId, sectionId);
    const version = await ContentVersionModel.findOne({ sectionId, versionNumber });
    if (!version) {
      throw AppError.notFound(`Version ${versionNumber} not found for this section.`);
    }
    section.currentVersion = versionNumber;
    await section.save();
    return contentVersionService.getCurrent(userId, projectId, chapterId, sectionId);
  },
};
