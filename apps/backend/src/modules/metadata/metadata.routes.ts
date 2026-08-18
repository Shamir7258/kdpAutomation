import { Router } from 'express';
import { updateMetadataSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { metadataController } from './metadata.controller.js';

export const metadataRouter = Router({ mergeParams: true });
metadataRouter.use(requireAuth);

metadataRouter.post('/', asyncHandler(metadataController.generate));
metadataRouter.get('/', asyncHandler(metadataController.get));
metadataRouter.patch('/', validate(updateMetadataSchema), asyncHandler(metadataController.update));
