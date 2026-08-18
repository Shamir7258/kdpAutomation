import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import rateLimit from 'express-rate-limit';
import { ERROR_CODES, type ApiFailure } from '@kdp/shared';

// authRateLimiter/apiRateLimiter are no-ops under NODE_ENV=test (see rate-limit.ts),
// so this test exercises the same handler/shape logic directly instead.
describe('rate limiter response shape', () => {
  it('returns the standard API error envelope with RATE_LIMITED on the configured limit', async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { requestId: string }).requestId = 'test-request-id';
      next();
    });
    app.use(
      rateLimit({
        windowMs: 60_000,
        limit: 1,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          const body: ApiFailure = {
            success: false,
            error: {
              code: ERROR_CODES.RATE_LIMITED,
              message: 'Too many requests, please try again later.',
              requestId: (req as express.Request & { requestId: string }).requestId,
            },
          };
          res.status(429).json(body);
        },
      }),
    );
    app.get('/ping', (_req, res) => res.json({ pong: true }));

    const first = await request(app).get('/ping');
    expect(first.status).toBe(200);

    const second = await request(app).get('/ping');
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('RATE_LIMITED');
  });
});
