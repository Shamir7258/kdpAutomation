import type { Request, Response } from 'express';
import type { GenerateInteriorInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { interiorService } from './interior.service.js';

export const interiorController = {
  async generate(req: Request, res: Response): Promise<void> {
    const job = await interiorService.generate(req.user!.id, req.params.id!, req.body as GenerateInteriorInput);
    ok(res, job, 202);
  },

  async list(req: Request, res: Response): Promise<void> {
    const interiors = await interiorService.list(req.user!.id, req.params.id!);
    ok(res, interiors);
  },
};
