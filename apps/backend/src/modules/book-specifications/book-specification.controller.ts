import type { Request, Response } from 'express';
import type { CreateBookSpecificationInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { bookSpecificationService } from './book-specification.service.js';

export const bookSpecificationController = {
  async create(req: Request, res: Response): Promise<void> {
    const spec = await bookSpecificationService.createFromIdea(
      req.user!.id,
      req.params.id!,
      req.body as CreateBookSpecificationInput,
    );
    ok(res, spec, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    const spec = await bookSpecificationService.getByProject(req.user!.id, req.params.id!);
    ok(res, spec);
  },
};
