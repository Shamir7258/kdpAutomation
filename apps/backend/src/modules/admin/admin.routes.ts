import { Router } from 'express';
import { updateUserSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { requireAuth, requireRole } from '../auth/auth.guard.js';
import { adminController } from './admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

adminRouter.get('/users', asyncHandler(adminController.listUsers));
adminRouter.patch('/users/:userId', validate(updateUserSchema), asyncHandler(adminController.updateUser));
adminRouter.get('/validation-rules', asyncHandler(adminController.getValidationRules));
adminRouter.get('/system-info', asyncHandler(adminController.getSystemInfo));
