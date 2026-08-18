import { Router } from 'express';
import { z } from 'zod';
import {
  createChapterSchema,
  createSectionSchema,
  reorderChaptersSchema,
  reorderSectionsSchema,
  updateChapterSchema,
  updateSectionSchema,
} from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { outlineController } from './outline.controller.js';

const idParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  chapterId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  sectionId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export const outlineRouter = Router({ mergeParams: true });
outlineRouter.use(requireAuth);
outlineRouter.use(validate(idParamsSchema, 'params'));

outlineRouter.get('/', asyncHandler(outlineController.list));
outlineRouter.post('/', asyncHandler(outlineController.generateFull));

outlineRouter.post('/chapters', validate(createChapterSchema), asyncHandler(outlineController.addChapter));
outlineRouter.post('/chapters/reorder', validate(reorderChaptersSchema), asyncHandler(outlineController.reorderChapters));
outlineRouter.patch('/chapters/:chapterId', validate(updateChapterSchema), asyncHandler(outlineController.updateChapter));
outlineRouter.delete('/chapters/:chapterId', asyncHandler(outlineController.deleteChapter));
outlineRouter.post('/chapters/:chapterId/regenerate', asyncHandler(outlineController.regenerateChapter));

outlineRouter.post(
  '/chapters/:chapterId/sections',
  validate(createSectionSchema),
  asyncHandler(outlineController.addSection),
);
outlineRouter.post(
  '/chapters/:chapterId/sections/reorder',
  validate(reorderSectionsSchema),
  asyncHandler(outlineController.reorderSections),
);
outlineRouter.patch(
  '/chapters/:chapterId/sections/:sectionId',
  validate(updateSectionSchema),
  asyncHandler(outlineController.updateSection),
);
outlineRouter.delete('/chapters/:chapterId/sections/:sectionId', asyncHandler(outlineController.deleteSection));
outlineRouter.post('/chapters/:chapterId/sections/:sectionId/regenerate', asyncHandler(outlineController.regenerateSection));
