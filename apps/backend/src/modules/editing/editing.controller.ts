import type { Request, Response } from 'express';
import { ok } from '../../common/http/respond.js';
import { editingService } from './editing.service.js';

export const editingController = {
  async runPipeline(req: Request, res: Response): Promise<void> {
    const job = await editingService.runPipeline(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!);
    ok(res, job, 202);
  },

  async listPasses(req: Request, res: Response): Promise<void> {
    ok(res, await editingService.listPasses(req.user!.id, req.params.id!, req.params.chapterId!, req.params.sectionId!));
  },
};
