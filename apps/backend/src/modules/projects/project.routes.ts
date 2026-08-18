import { Router } from 'express';
import { z } from 'zod';
import { createProjectSchema, listProjectsQuerySchema, updateProjectSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth } from '../auth/auth.guard.js';
import { projectController } from './project.controller.js';

const idParamSchema = z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid project id') });

export const projectRouter = Router();
projectRouter.use(requireAuth);

projectRouter.post('/', validate(createProjectSchema), asyncHandler(projectController.create));
projectRouter.get('/', validate(listProjectsQuerySchema, 'query'), asyncHandler(projectController.list));
projectRouter.get('/:id', validate(idParamSchema, 'params'), asyncHandler(projectController.getById));
projectRouter.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(updateProjectSchema),
  asyncHandler(projectController.update),
);
projectRouter.post('/:id/duplicate', validate(idParamSchema, 'params'), asyncHandler(projectController.duplicate));
projectRouter.post('/:id/archive', validate(idParamSchema, 'params'), asyncHandler(projectController.archive));
projectRouter.post('/:id/restore', validate(idParamSchema, 'params'), asyncHandler(projectController.restore));
projectRouter.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(projectController.remove));
