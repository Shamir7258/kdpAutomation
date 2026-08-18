import { Router } from 'express';
import { z } from 'zod';
import { generateIdeasSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { bookIdeaController } from './book-idea.controller.js';

const updateStatusSchema = z.object({ status: z.enum(['saved', 'rejected']) });

export const bookIdeaRouter = Router({ mergeParams: true });
bookIdeaRouter.use(requireAuth);

bookIdeaRouter.post('/', validate(generateIdeasSchema), asyncHandler(bookIdeaController.generate));
bookIdeaRouter.get('/', asyncHandler(bookIdeaController.list));
bookIdeaRouter.patch('/:ideaId', validate(updateStatusSchema), asyncHandler(bookIdeaController.updateStatus));
