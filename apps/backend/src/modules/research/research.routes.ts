import { Router } from 'express';
import { generateResearchSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { researchController } from './research.controller.js';

export const researchRouter = Router({ mergeParams: true });
researchRouter.use(requireAuth);

researchRouter.post('/', validate(generateResearchSchema), asyncHandler(researchController.generate));
researchRouter.get('/', asyncHandler(researchController.list));
researchRouter.get('/latest', asyncHandler(researchController.getLatest));
