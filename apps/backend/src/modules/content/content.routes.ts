import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { contentController } from './content.controller.js';

const idParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  chapterId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  sectionId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  versionNumber: z.coerce.number().int().positive().optional(),
});

export const contentRouter = Router({ mergeParams: true });
contentRouter.use(requireAuth);
contentRouter.use(validate(idParamsSchema, 'params'));

contentRouter.post('/', asyncHandler(contentController.generateBook));
contentRouter.post('/chapters/:chapterId', asyncHandler(contentController.generateChapter));
contentRouter.post('/chapters/:chapterId/sections/:sectionId', asyncHandler(contentController.generateSection));
contentRouter.get('/chapters/:chapterId/sections/:sectionId', asyncHandler(contentController.getSectionContent));
contentRouter.get('/chapters/:chapterId/sections/:sectionId/versions', asyncHandler(contentController.listVersions));
contentRouter.post(
  '/chapters/:chapterId/sections/:sectionId/versions/:versionNumber/restore',
  asyncHandler(contentController.restoreVersion),
);
