import IORedis from 'ioredis';

/**
 * BullMQ needs a real Redis (its Lua-script-heavy protocol isn't safely
 * mockable — see ARCHITECTURE.md §5). Rather than hard-require Redis for
 * the whole suite, queue-dependent tests probe reachability first and
 * skip (not fail) when it's unavailable, so `npm test` still passes on a
 * machine/CI without Redis running — full coverage kicks in wherever
 * Redis is present (this dev sandbox, docker-compose.dev.yml, CI with the
 * compose stack up).
 */
export async function isRedisAvailable(url: string): Promise<boolean> {
  const client = new IORedis(url, { lazyConnect: true, maxRetriesPerRequest: 1, retryStrategy: () => null });
  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}
