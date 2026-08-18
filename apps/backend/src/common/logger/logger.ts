import pino from 'pino';
import { loadConfig } from '@kdp/config';

const config = loadConfig();

/**
 * Structured logger. Redacts secret-bearing fields at the pino level so a
 * stray `logger.info({ req })` or similar can never leak credentials —
 * §30 forbids logging API keys, passwords, and tokens.
 */
export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : config.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.accessToken',
      '*.refreshToken',
      '*.token',
      '*.apiKey',
      '*.ANTHROPIC_API_KEY',
      '*.OPENAI_API_KEY',
      '*.AWS_SECRET_ACCESS_KEY',
    ],
    censor: '[REDACTED]',
  },
  transport:
    config.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
