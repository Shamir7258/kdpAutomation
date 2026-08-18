import IORedis from 'ioredis';
import { loadConfig } from '@kdp/config';

let connection: IORedis | undefined;

/**
 * Shared ioredis connection for BullMQ. `maxRetriesPerRequest: null` is
 * required by BullMQ — without it, ioredis' default retry limit fights
 * BullMQ's own blocking-command retry loop and jobs intermittently fail
 * with a "reached the max retries" error unrelated to the job itself.
 */
export function getRedisConnection(): IORedis {
  if (!connection) {
    const config = loadConfig();
    connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
