import { z } from 'zod';

/**
 * Every environment variable the platform uses, across all phases (§40).
 * Fields not yet needed by the current phase are optional; providers that
 * require them (AI, S3 storage) validate their own required-ness lazily
 * when actually selected, so an unconfigured provider fails loudly at the
 * point of use rather than silently no-opping.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:5173'),

  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1).default('mongodb://localhost:27017/kdp_automation'),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().optional(),

  AI_PROVIDER: z.enum(['claude', 'openai', 'mock']).default('mock'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),

  IMAGE_PROVIDER: z.enum(['openai', 'mock']).default('mock'),

  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_ROOT: z.string().default('./data/storage'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),

  MAX_FILE_SIZE: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  JOB_CONCURRENCY: z.coerce.number().int().positive().default(2),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | undefined;

/** Parses and validates process.env once, memoizing the result. Throws with a readable message on misconfiguration. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppEnv {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only escape hatch to force a fresh parse (e.g. after mutating process.env between tests). */
export function resetConfigCache(): void {
  cached = undefined;
}
