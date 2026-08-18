import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { ok } from '../../common/http/respond.js';
import { requireAuth } from '../auth/auth.guard.js';
import { dashboardService } from './dashboard.service.js';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

dashboardRouter.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await dashboardService.getStats(req.user!.id);
    ok(res, stats);
  }),
);
