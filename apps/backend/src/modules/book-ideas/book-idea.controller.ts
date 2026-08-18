import type { Request, Response } from 'express';
import type { GenerateIdeasInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { bookIdeaService } from './book-idea.service.js';

export const bookIdeaController = {
  async generate(req: Request, res: Response): Promise<void> {
    const { count } = req.body as GenerateIdeasInput;
    const ideas = await bookIdeaService.generate(req.user!.id, req.params.id!, count);
    ok(res, ideas, 201);
  },

  async list(req: Request, res: Response): Promise<void> {
    const ideas = await bookIdeaService.list(req.user!.id, req.params.id!);
    ok(res, ideas);
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const { status } = req.body as { status: 'saved' | 'rejected' };
    const idea = await bookIdeaService.updateStatus(req.user!.id, req.params.id!, req.params.ideaId!, status);
    ok(res, idea);
  },
};
