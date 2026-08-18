import type { Request, Response } from 'express';
import { ok } from '../../common/http/respond.js';
import { contentService } from './content.service.js';
import { contentVersionService } from '../content-versions/content-version.service.js';

export const contentController = {
  async generateBook(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.generateBook(req.user!.id, req.params.id!), 202);
  },

  async generateChapter(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.generateChapter(req.user!.id, req.params.id!, req.params.chapterId!), 202);
  },

  async generateSection(req: Request, res: Response): Promise<void> {
    ok(res, await contentService.generateSection(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!), 202);
  },

  async getSectionContent(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await contentVersionService.getCurrent(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!),
    );
  },

  async listVersions(req: Request, res: Response): Promise<void> {
    ok(
      res,
      await contentVersionService.listVersions(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!),
    );
  },

  async restoreVersion(req: Request, res: Response): Promise<void> {
    const versionNumber = Number(req.params.versionNumber);
    ok(
      res,
      await contentVersionService.restore(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!, versionNumber),
    );
  },
};
