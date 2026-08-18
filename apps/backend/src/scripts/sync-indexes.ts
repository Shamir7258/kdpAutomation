/**
 * Ensures every Mongoose model's declared indexes exist in the database.
 * Run via `npm run migrate`. This is the real (non-fake) migration story
 * for Phase 1 — there's no relational schema to migrate yet, but indexes
 * still need to be created/kept in sync outside of app boot in production
 * (autoIndex is disabled there for write-path safety).
 */
import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../db/mongoose.js';
import { logger } from '../common/logger/logger.js';
import { UserModel } from '../modules/auth/user.model.js';
import { SessionModel } from '../modules/auth/session.model.js';
import { ProjectModel } from '../modules/projects/project.model.js';
import { PromptTemplateModel } from '../modules/prompt-templates/prompt-template.model.js';
import { promptTemplateService } from '../modules/prompt-templates/prompt-template.service.js';
import { AIUsageModel } from '../modules/ai-usage/ai-usage.model.js';
import { BookIdeaModel } from '../modules/book-ideas/book-idea.model.js';
import { BookSpecificationModel } from '../modules/book-specifications/book-specification.model.js';
import { ResearchModel } from '../modules/research/research.model.js';
import { ChapterModel } from '../modules/outline/chapter.model.js';
import { SectionModel } from '../modules/outline/section.model.js';
import { JobModel } from '../modules/jobs/job.model.js';
import { ContentVersionModel } from '../modules/content-versions/content-version.model.js';
import { EditPassModel } from '../modules/editing/edit-pass.model.js';
import { MetadataModel } from '../modules/metadata/metadata.model.js';
import { InteriorModel } from '../modules/interior/interior.model.js';

async function main(): Promise<void> {
  await connectDatabase();
  for (const model of [
    UserModel,
    SessionModel,
    ProjectModel,
    PromptTemplateModel,
    AIUsageModel,
    BookIdeaModel,
    BookSpecificationModel,
    ResearchModel,
    ChapterModel,
    SectionModel,
    JobModel,
    ContentVersionModel,
    EditPassModel,
    MetadataModel,
    InteriorModel,
  ]) {
    await model.syncIndexes();
    logger.info({ model: model.modelName }, 'indexes synced');
  }
  await promptTemplateService.seedDefaults();
  logger.info('prompt templates seeded');
  await disconnectDatabase();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Index sync failed', err);
  process.exit(1);
});
