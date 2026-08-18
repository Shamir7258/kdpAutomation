// Loaded via vitest `setupFiles` — runs to completion before any test file's
// own imports execute, so env vars land before other modules call
// loadConfig() at their top level (e.g. logger.ts, rate-limit.ts).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production-32chars';
process.env.CORS_ORIGIN = 'http://localhost:5173';
