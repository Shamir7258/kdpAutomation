import type { Request, Response } from 'express';
import { ok } from '../../common/http/respond.js';
import { exportService } from './export.service.js';

export const exportController = {
  async generate(req: Request, res: Response): Promise<void> {
    const job = await exportService.generate(req.user!.id, req.params.id!);
    ok(res, job, 202);
  },

  async list(req: Request, res: Response): Promise<void> {
    const exports = await exportService.list(req.user!.id, req.params.id!);
    ok(res, exports);
  },
};
