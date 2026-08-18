import { Router } from 'express';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { requireAuth } from '../auth/auth.guard.js';
import { validationController } from './validation.controller.js';

export const validationRouter = Router({ mergeParams: true });
validationRouter.use(requireAuth);

validationRouter.get('/', asyncHandler(validationController.run));
