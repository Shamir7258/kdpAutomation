import { Router } from 'express';
import { generateInteriorSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { interiorController } from './interior.controller.js';

export const interiorRouter = Router({ mergeParams: true });
interiorRouter.use(requireAuth);

interiorRouter.post('/', validate(generateInteriorSchema), asyncHandler(interiorController.generate));
interiorRouter.get('/', asyncHandler(interiorController.list));
