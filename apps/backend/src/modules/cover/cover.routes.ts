import { Router } from 'express';
import { generateCoverSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { coverController } from './cover.controller.js';

export const coverRouter = Router({ mergeParams: true });
coverRouter.use(requireAuth);

coverRouter.post('/', validate(generateCoverSchema), asyncHandler(coverController.generate));
coverRouter.get('/', asyncHandler(coverController.list));
