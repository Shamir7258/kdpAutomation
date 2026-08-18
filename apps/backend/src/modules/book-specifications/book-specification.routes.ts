import { Router } from 'express';
import { createBookSpecificationSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { bookSpecificationController } from './book-specification.controller.js';

export const bookSpecificationRouter = Router({ mergeParams: true });
bookSpecificationRouter.use(requireAuth);

bookSpecificationRouter.post('/', validate(createBookSpecificationSchema), asyncHandler(bookSpecificationController.create));
bookSpecificationRouter.get('/', asyncHandler(bookSpecificationController.get));
