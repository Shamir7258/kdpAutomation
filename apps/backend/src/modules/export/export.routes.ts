import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { requireAuth } from '../auth/auth.guard.js';
import { exportController } from './export.controller.js';

export const exportRouter = Router({ mergeParams: true });
exportRouter.use(requireAuth);

exportRouter.post('/', asyncHandler(exportController.generate));
exportRouter.get('/', asyncHandler(exportController.list));
