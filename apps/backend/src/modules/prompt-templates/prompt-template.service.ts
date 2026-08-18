import { AppError } from '../../common/errors/app-error.js';
import { PromptTemplateModel, type PromptTemplateDocument } from './prompt-template.model.js';

export const PROMPT_TEMPLATE_NAMES = {
  BOOK_IDEA_GENERATOR: 'BOOK_IDEA_GENERATOR',
} as const;

interface DefaultTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
  variables: string[];
}

const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: PROMPT_TEMPLATE_NAMES.BOOK_IDEA_GENERATOR,
    description: 'Generates candidate book ideas for a project niche (§10).',
    systemPrompt:
      'You are a KDP publishing strategist who generates commercially viable, differentiated book ideas. ' +
      'You never guarantee sales or rankings, and you always flag realistic content/legal risks.',
    userPrompt: [
      'Generate {{count}} distinct book ideas for a "{{bookTypeLabel}}" ({{bookTypeDescription}}).',
      'Niche: {{niche}}',
      'Target audience (if specified by the user): {{targetAudience}}',
      'Language: {{language}}',
      'Guidance for this book type: {{ideaPromptHint}}',
      '',
      'Each idea must have a distinct unique angle — do not produce near-duplicates. For each idea provide:',
      'title, subtitle, targetAudience, problemSolved, uniqueAngle, estimatedPageCount, difficulty',
      '(beginner|intermediate|advanced), contentType, differentiation, and potentialRisks (a list of',
      'realistic content/legal/market risks — never leave this empty; if genuinely low-risk, say so explicitly).',
    ].join('\n'),
    variables: ['count', 'bookTypeLabel', 'bookTypeDescription', 'niche', 'targetAudience', 'language', 'ideaPromptHint'],
  },
];

function toRecord(doc: PromptTemplateDocument) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    version: doc.version,
    description: doc.description,
    systemPrompt: doc.systemPrompt,
    userPrompt: doc.userPrompt,
    variables: doc.variables,
    active: doc.active,
  };
}

export const promptTemplateService = {
  /** Idempotent — called from the migrate script and on backend boot so a fresh DB always has the templates code depends on. */
  async seedDefaults(): Promise<void> {
    for (const template of DEFAULT_TEMPLATES) {
      await PromptTemplateModel.updateOne(
        { name: template.name },
        {
          $setOnInsert: {
            description: template.description,
            systemPrompt: template.systemPrompt,
            userPrompt: template.userPrompt,
            variables: template.variables,
            active: true,
            version: 1,
          },
        },
        { upsert: true },
      );
    }
  },

  async getActiveByName(name: string) {
    const doc = await PromptTemplateModel.findOne({ name, active: true });
    if (!doc) {
      throw AppError.notFound(`No active prompt template named "${name}". Run the migrate script to seed defaults.`);
    }
    return toRecord(doc);
  },

  async list() {
    const docs = await PromptTemplateModel.find().sort({ name: 1 });
    return docs.map(toRecord);
  },
};
