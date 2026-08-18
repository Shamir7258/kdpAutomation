import 'dotenv/config';
import { loadConfig } from '@kdp/config';
import { createApp } from './app.js';
import { connectDatabase } from './db/mongoose.js';
import { logger } from './common/logger/logger.js';
import { promptTemplateService } from './modules/prompt-templates/prompt-template.service.js';
import { startContentGenerationWorker, stopContentGenerationWorker } from './queue/workers/content-generation.worker.js';
import { closeQueues } from './queue/queues.js';
import { closeRedisConnection } from './queue/redis.js';

async function main(): Promise<void> {
  const config = loadConfig();
  await connectDatabase();
  await promptTemplateService.seedDefaults();
  await startContentGenerationWorker().waitUntilReady();

  const app = createApp();
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'backend listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'shutting down');
    server.close(async () => {
      await stopContentGenerationWorker();
      await closeQueues();
      await closeRedisConnection();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});
