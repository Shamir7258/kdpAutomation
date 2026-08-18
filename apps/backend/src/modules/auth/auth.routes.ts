import { Router } from 'express';
import { loginSchema, registerSchema } from '@kdp/shared';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { validate } from '../../common/middleware/validate.js';
import { authRateLimiter } from '../../common/middleware/rate-limit.js';
import { authController } from './auth.controller.js';
import { requireAuth } from './auth.guard.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', authRateLimiter, asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
