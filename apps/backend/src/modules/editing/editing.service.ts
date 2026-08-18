import { randomUUID } from 'node:crypto';
import { EDIT_PASS_TYPES, type EditPassDto, type EditPassType, type JobDto } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { projectService } from '../projects/project.service.js';
import { ChapterModel } from '../outline/chapter.model.js';
import { SectionModel } from '../outline/section.model.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';
import { getEditingQueue, type EditingPipelineJobData } from '../../queue/queues.js';
import { QUEUE_NAMES } from '../../queue/queue-names.js';
import { jobService } from '../jobs/job.service.js';
import { EditPassModel, type EditPassDocument } from './edit-pass.model.js';

/**
 * Per §15: "Do NOT claim that AI detection can be guaranteed or bypassed.
 * Instead provide an editorial-quality assessment." These descriptions are
 * the actual compliance-sensitive prompt text handed to the AI provider —
 * not just documentation — so the wording here is load-bearing.
 */
const PASS_ANALYSIS_TYPE: Record<EditPassType, string> = {
  grammar: 'grammar and spelling — identify concrete grammar, punctuation, and spelling issues',
  clarity: 'clarity and readability — identify sentences or passages that are confusing, wordy, or hard to follow',
  consistency:
    'internal consistency — identify contradictions in names, facts, tone, or terminology within this section',
  structure: 'structure and organization — identify organizational issues (e.g. topics addressed out of order, missing transitions)',
  fact_checking:
    'factual accuracy — identify specific factual claims made in the text and flag any that cannot be confidently ' +
    'verified from general knowledge. Never fabricate a source or citation; if a claim cannot be verified, say so explicitly.',
  ai_detection_risk:
    'writing-pattern risk — an editorial-quality assessment of patterns that read as generic or repetitive AI writing ' +
    '(e.g. repetitive sentence structure, generic transitions, overused phrases). This is NOT a claim that any AI-detection ' +
    'tool can be bypassed or will/won\'t flag this content — frame findings purely as editorial suggestions.',
  final_review: 'final editorial review — a holistic read of whether this section is ready to publish, weighing all editorial concerns',
};

async function findOwnedSectionWithContext(userId: string, projectId: string, chapterId: string, sectionId: string) {
  const chapter = await ChapterModel.findOne({ _id: chapterId, projectId, userId });
  const section = await SectionModel.findOne({ _id: sectionId, chapterId, projectId, userId });
  if (!chapter || !section) {
    throw AppError.notFound('Chapter or section not found.');
  }
  if (section.currentVersion === 0) {
    throw AppError.validation('This section has no generated content yet — generate content before running the editing pipeline.');
  }
  const currentContent = await ContentVersionModel.findOne({ sectionId, versionNumber: section.currentVersion });
  if (!currentContent) {
    throw AppError.notFound('Current content version not found.');
  }
  return { chapter, section, content: currentContent.content };
}

function toDto(pass: EditPassDocument): EditPassDto {
  return {
    id: pass._id.toString(),
    sectionId: pass.sectionId.toString(),
    passType: pass.passType as EditPassType,
    batchId: pass.batchId,
    summary: pass.summary,
    findings: pass.findings.map((f) => ({
      type: f.type,
      description: f.description,
      severity: f.severity as EditPassDto['findings'][number]['severity'],
      location: f.location ?? undefined,
    })),
    createdAt: pass.createdAt.toISOString(),
  };
}

export const editingService = {
  async runPipeline(userId: string, projectId: string, chapterId: string, sectionId: string): Promise<JobDto> {
    await findOwnedSectionWithContext(userId, projectId, chapterId, sectionId);

    const batchId = randomUUID();
    const data: EditingPipelineJobData = { userId, projectId, chapterId, sectionId, batchId };
    const bullJob = await getEditingQueue().add('run-editing-pipeline', data);
    const jobDoc = await jobService.createPending({
      queueName: QUEUE_NAMES.EDITING,
      bullJobId: bullJob.id ?? randomUUID(),
      batchId,
      projectId,
      userId,
      chapterId,
      sectionId,
    });
    return jobService.toDto(jobDoc);
  },

  async listPasses(userId: string, projectId: string, chapterId: string, sectionId: string): Promise<EditPassDto[]> {
    await projectService.getById(userId, projectId);
    const passes = await EditPassModel.find({ sectionId, chapterId, projectId, userId }).sort({ createdAt: -1 });
    return passes.map(toDto);
  },
};

/**
 * The actual pipeline work, extracted so it's unit-testable without a
 * running Redis/BullMQ worker — mirrors content.service.ts's
 * runContentGeneration. Runs all 7 passes sequentially against the
 * section's current content; each pass is stored as it completes, so a
 * mid-pipeline failure still leaves the completed passes persisted.
 */
export async function runEditingPipeline(data: EditingPipelineJobData): Promise<void> {
  const { userId, projectId, chapterId, sectionId, batchId } = data;
  const { content } = await findOwnedSectionWithContext(userId, projectId, chapterId, sectionId);
  const provider = getAIProvider();

  for (const passType of EDIT_PASS_TYPES) {
    const result = await provider.analyzeContent(content, PASS_ANALYSIS_TYPE[passType]);
    await aiUsageService.record({ userId, projectId, provider: provider.name, operation: `edit_pass_${passType}`, result });

    await EditPassModel.create({
      sectionId,
      chapterId,
      projectId,
      userId,
      passType,
      batchId,
      summary: result.data.summary,
      findings: result.data.findings,
    });
  }
}
