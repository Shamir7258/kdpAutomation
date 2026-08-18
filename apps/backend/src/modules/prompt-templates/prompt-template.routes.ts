import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { ok } from '../../common/http/respond.js';
import { requireAuth, requireRole } from '../auth/auth.guard.js';
import { promptTemplateService } from './prompt-template.service.js';

export const promptTemplateRouter = Router();
promptTemplateRouter.use(requireAuth, requireRole('admin'));

promptTemplateRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    ok(res, await promptTemplateService.list());
  }),
);
