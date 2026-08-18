import type { Request, Response } from 'express';
import type {
  CreateChapterInput,
  CreateSectionInput,
  ReorderChaptersInput,
  ReorderSectionsInput,
  UpdateChapterInput,
  UpdateSectionInput,
} from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { outlineService } from './outline.service.js';

export const outlineController = {
  async list(req: Request, res: Response): Promise<void> {
    ok(res, await outlineService.list(req.user!.id, req.params.id!));
  },

  async generateFull(req: Request, res: Response): Promise<void> {
    ok(res, await outlineService.generateFull(req.user!.id, req.params.id!), 201);
  },

  async addChapter(req: Request, res: Response): Promise<void> {
    ok(res, await outlineService.addChapter(req.user!.id, req.params.id!, req.body as CreateChapterInput), 201);
  },

  async updateChapter(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await outlineService.updateChapter(req.user!.id, req.params.id!, req.params.chapterId!, req.body as UpdateChapterInput),
    );
  },

  async deleteChapter(req: Request, res: Response): Promise<void> {
    await outlineService.deleteChapter(req.user!.id, req.params.id!, req.params.chapterId!);
    ok(res, { deleted: true });
  },

  async reorderChapters(req: Request, res: Response): Promise<void> {
    ok(res, await outlineService.reorderChapters(req.user!.id, req.params.id!, req.body as ReorderChaptersInput));
  },

  async regenerateChapter(req: Request, res: Response): Promise<void> {
    ok(res, await outlineService.regenerateChapter(req.user!.id, req.params.id!, req.params.chapterId!));
  },

  async addSection(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await outlineService.addSection(req.user!.id, req.params.id!, req.params.chapterId!, req.body as CreateSectionInput),
      201,
    );
  },

  async updateSection(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await outlineService.updateSection(
        req.user!.id,
        req.params.id!,
        req.params.chapterId!,
        req.params.sectionId!,
        req.body as UpdateSectionInput,
      ),
    );
  },

  async deleteSection(req: Request, res: Response): Promise<void> {
    await outlineService.deleteSection(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!);
    ok(res, { deleted: true });
  },

  async reorderSections(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await outlineService.reorderSections(req.user!.id, req.params.id!, req.params.chapterId!, req.body as ReorderSectionsInput),
    );
  },

  async regenerateSection(req: Request, res: Response): Promise<void> {
    ok(res, await outlineService.regenerateSection(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!));
  },
};
