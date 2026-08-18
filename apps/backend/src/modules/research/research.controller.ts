import type { Request, Response } from 'express';
import type { GenerateResearchInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { researchService } from './research.service.js';

export const researchController = {
  async generate(req: Request, res: Response): Promise<void> {
    const research = await researchService.generate(req.user!.id, req.params.id!, req.body as GenerateResearchInput);
    ok(res, research, 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    ok(res, await researchService.list(req.user!.id, req.params.id!));
  },

  async getLatest(req: Request, res: Response): Promise<void> {
    ok(res, await researchService.getLatest(req.user!.id, req.params.id!));
  },
};
