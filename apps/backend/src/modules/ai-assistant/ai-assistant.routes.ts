import { Router } from 'express';
import { z } from 'zod';
import { assistantRequestSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { aiAssistantController } from './ai-assistant.controller.js';

const idParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  chapterId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  sectionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

export const aiAssistantRouter = Router({ mergeParams: true });
aiAssistantRouter.use(requireAuth);
aiAssistantRouter.use(validate(idParamsSchema, 'params'));

aiAssistantRouter.post('/', validate(assistantRequestSchema), asyncHandler(aiAssistantController.run));
