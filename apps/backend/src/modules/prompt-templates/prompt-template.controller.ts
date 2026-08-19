import type { Request, Response } from 'express';
import type { CreatePromptTemplateInput, UpdatePromptTemplateInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { promptTemplateService } from './prompt-template.service.js';

export const promptTemplateController = {
  async list(_req: Request, res: Response): Promise<void> {
    ok(res, await promptTemplateService.list());
  },

  async create(req: Request, res: Response): Promise<void> {
    const template = await promptTemplateService.create(req.body as CreatePromptTemplateInput);
    ok(res, template, 201);
  },

  async update(req: Request, res: Response): Promise<void> {
    const template = await promptTemplateService.update(req.params.id!, req.body as UpdatePromptTemplateInput);
    ok(res, template);
  },
};
