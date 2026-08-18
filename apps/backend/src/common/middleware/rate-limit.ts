import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { loadConfig } from '@kdp/config';
import { ERROR_CODES, type ApiFailure } from '@kdp/shared';

const config = loadConfig();

// Rate limiting is real infrastructure and stays wired up in the test app
// build (createApp() is identical in tests and production), but the limits
// themselves would make functional test suites flaky/order-dependent
// against a shared in-memory store, so it's a no-op in NODE_ENV=test.
const skipInTests = () => config.NODE_ENV === 'test';

/** General-purpose limiter mounted on all /api routes. In-memory store — see ARCHITECTURE.md §5 for the multi-instance caveat. */
export const apiRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: (req: Request, res: Response) => {
    const body: ApiFailure = {
      success: false,
      error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many requests, please try again later.', requestId: req.requestId },
    };
    res.status(429).json(body);
  },
});

/** Tighter limiter for auth endpoints (login/register/refresh) to slow down credential-stuffing / brute force. */
export const authRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: (req: Request, res: Response) => {
    const body: ApiFailure = {
      success: false,
      error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many attempts, please slow down.', requestId: req.requestId },
    };
    res.status(429).json(body);
  },
});
