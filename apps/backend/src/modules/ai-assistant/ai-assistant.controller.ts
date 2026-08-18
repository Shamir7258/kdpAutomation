import type { Request, Response } from 'express';
import type { AssistantRequestInput } from '@kdp/shared';
import { ok } from '../../common/http/respond.js';
import { aiAssistantService } from './ai-assistant.service.js';

export const aiAssistantController = {
  async run(req: Request, res: Response): Promise<void> {
    const result = await aiAssistantService.run(
      req.user!.id,
      req.params.id!,
      req.params.chapterId!,
      req.params.sectionId!,
      req.body as AssistantRequestInput,
    );
    ok(res, result);
  },
};
