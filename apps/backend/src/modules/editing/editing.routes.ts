import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { editingController } from './editing.controller.js';

const idParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  chapterId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  sectionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
});

export const editingRouter = Router({ mergeParams: true });
editingRouter.use(requireAuth);
editingRouter.use(validate(idParamsSchema, 'params'));

editingRouter.post('/', asyncHandler(editingController.runPipeline));
editingRouter.get('/', asyncHandler(editingController.listPasses));
