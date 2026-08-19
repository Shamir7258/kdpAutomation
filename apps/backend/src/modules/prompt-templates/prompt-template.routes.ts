import { Router } from 'express';
import { createPromptTemplateSchema, updatePromptTemplateSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.guard.js';
import { promptTemplateController } from './prompt-template.controller.js';

export const promptTemplateRouter = Router();
promptTemplateRouter.use(requireAuth, requireRole('admin'));

promptTemplateRouter.get('/', asyncHandler(promptTemplateController.list));
promptTemplateRouter.post('/', validate(createPromptTemplateSchema), asyncHandler(promptTemplateController.create));
promptTemplateRouter.patch('/:id', validate(updatePromptTemplateSchema), asyncHandler(promptTemplateController.update));
