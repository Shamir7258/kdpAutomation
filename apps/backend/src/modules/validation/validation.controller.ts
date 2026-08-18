import type { Request, Response } from 'express';
import { ok } from '../../common/http/respond.js';
import { validationService } from './validation.service.js';

export const validationController = {
  async run(req: Request, res: Response): Promise<void> {
    const report = await validationService.run(req.user!.id, req.params.id!);
    ok(res, report);
  },
};
