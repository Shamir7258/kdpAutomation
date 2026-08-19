import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { loadConfig } from '@kdp/config';
import { requestContext } from './common/middleware/request-context.js';
import { apiRateLimiter } from './common/middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './common/middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { projectRouter } from './modules/projects/project.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { bookIdeaRouter } from './modules/book-ideas/book-idea.routes.js';
import { bookSpecificationRouter } from './modules/book-specifications/book-specification.routes.js';
import { promptTemplateRouter } from './modules/prompt-templates/prompt-template.routes.js';
import { researchRouter } from './modules/research/research.routes.js';
import { outlineRouter } from './modules/outline/outline.routes.js';
import { contentRouter } from './modules/content/content.routes.js';
import { jobRouter } from './modules/jobs/job.routes.js';
import { aiAssistantRouter } from './modules/ai-assistant/ai-assistant.routes.js';
import { editingRouter } from './modules/editing/editing.routes.js';
import { metadataRouter } from './modules/metadata/metadata.routes.js';
import { interiorRouter } from './modules/interior/interior.routes.js';
import { coverRouter } from './modules/cover/cover.routes.js';
import { validationRouter } from './modules/validation/validation.routes.js';
import { exportRouter } from './modules/export/export.routes.js';
import { filesRouter } from './modules/storage/files.routes.js';

export function createApp(): Express {
  const config = loadConfig();
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());
  app.use(mongoSanitize());
  app.use(requestContext);
  app.use('/api', apiRateLimiter);

  app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectRouter);
  app.use('/api/projects/:id/ideas', bookIdeaRouter);
  app.use('/api/projects/:id/specification', bookSpecificationRouter);
  app.use('/api/projects/:id/research', researchRouter);
  app.use('/api/projects/:id/outline', outlineRouter);
  app.use('/api/projects/:id/content', contentRouter);
  app.use('/api/projects/:id/metadata', metadataRouter);
  app.use('/api/projects/:id/interior', interiorRouter);
  app.use('/api/projects/:id/cover', coverRouter);
  app.use('/api/projects/:id/validation', validationRouter);
  app.use('/api/projects/:id/export', exportRouter);
  app.use('/api/projects/:id/jobs', jobRouter);
  app.use('/api/projects/:id/chapters/:chapterId/sections/:sectionId/assistant', aiAssistantRouter);
  app.use('/api/projects/:id/chapters/:chapterId/sections/:sectionId/edit-passes', editingRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/prompt-templates', promptTemplateRouter);
  app.use('/api/files', filesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
