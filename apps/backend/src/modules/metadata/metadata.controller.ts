import type { Request, Response } from 'express';
import type { UpdateMetadataInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { metadataService } from './metadata.service.js';

export const metadataController = {
  async generate(req: Request, res: Response): Promise<void> {
    const metadata = await metadataService.generate(req.user!.id, req.params.id!);
    ok(res, metadata, 201);
  },

  async get(req: Request, res: Response): Promise<void> {
    const metadata = await metadataService.getByProject(req.user!.id, req.params.id!);
    ok(res, metadata);
  },

  async update(req: Request, res: Response): Promise<void> {
    const metadata = await metadataService.update(req.user!.id, req.params.id!, req.body as UpdateMetadataInput);
    ok(res, metadata);
  },
};
