import rateLimit from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import IORedis from 'ioredis';
import type { Request, Response } from 'express';
import { loadConfig } from '@kdp/config';
import { ERROR_CODES, type ApiFailure } from '@kdp/shared';

const config = loadConfig();

// Rate limiting is real infrastructure and stays wired up in the test app
// build (createApp() is identical in tests and production), but the limits
// themselves would make functional test suites flaky/order-dependent
// against a shared store, so it's a no-op in NODE_ENV=test.
const skipInTests = () => config.NODE_ENV === 'test';

// Dedicated connection, separate from BullMQ's (queue/redis.ts): that one sets
// `maxRetriesPerRequest: null` because BullMQ's blocking commands require it, but the
// same setting on a rate-limit INCR sitting in the synchronous request path would let a
// Redis outage hang requests indefinitely instead of failing fast. Backed by Redis (rather
// than the previous in-memory store) so limits are enforced consistently once the backend
// runs as more than one instance — see ARCHITECTURE.md §5. `lazyConnect` matters for tests:
// both limiters are no-ops under NODE_ENV=test (skipInTests), so the store is never touched
// and this never attempts a connection — consistent with the rest of the suite (see
// queue-test-utils.ts) not hard-requiring Redis to be running.
const rateLimitRedisClient = new IORedis(config.REDIS_URL, { lazyConnect: true });
// Each limiter needs its own key prefix — both default to keying on req.ip, and without
// distinct prefixes the two limiters' counters would collide in Redis.
const redisStore = (prefix: string) =>
  new RedisStore({
    prefix,
    sendCommand: (command: string, ...args: string[]) => rateLimitRedisClient.call(command, ...args) as Promise<RedisReply>,
  });

/** General-purpose limiter mounted on all /api routes. */
export const apiRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  limit: config.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  store: redisStore('rl:api:'),
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
  store: redisStore('rl:auth:'),
  handler: (req: Request, res: Response) => {
    const body: ApiFailure = {
      success: false,
      error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many attempts, please slow down.', requestId: req.requestId },
    };
    res.status(429).json(body);
  },
});

export async function closeRateLimitRedisConnection(): Promise<void> {
  await rateLimitRedisClient.quit();
}
