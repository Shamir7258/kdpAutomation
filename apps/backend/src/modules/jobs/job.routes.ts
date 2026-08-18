import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { ok } from '../../common/http/respond.js';
import { requireAuth } from '../auth/auth.guard.js';
import { contentService } from '../content/content.service.js';

export const jobRouter = Router({ mergeParams: true });
jobRouter.use(requireAuth);

jobRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    ok(res, await contentService.listJobs(req.user!.id, req.params.id!));
  }),
);
