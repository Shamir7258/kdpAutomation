import type { Request, Response } from 'express';
import type { GenerateCoverInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { coverService } from './cover.service.js';

export const coverController = {
  async generate(req: Request, res: Response): Promise<void> {
    const job = await coverService.generate(req.user!.id, req.params.id!, req.body as GenerateCoverInput);
    ok(res, job, 202);
  },

  async list(req: Request, res: Response): Promise<void> {
    const covers = await coverService.list(req.user!.id, req.params.id!);
    ok(res, covers);
  },
};
