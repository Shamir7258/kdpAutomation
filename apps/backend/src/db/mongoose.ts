import mongoose from 'mongoose';
import { loadConfig } from '@kdp/config';
import { logger } from '../common/logger/logger.js';

export async function connectDatabase(uri?: string): Promise<typeof mongoose> {
  const config = loadConfig();
  mongoose.set('strictQuery', true);
  mongoose.set('autoIndex', config.NODE_ENV !== 'production');
  const connection = await mongoose.connect(uri ?? config.DATABASE_URL);
  logger.info({ host: connection.connection.host, db: connection.connection.name }, 'connected to MongoDB');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
