import { z } from 'zod';
import type { AssistantRequestInput, AssistantResult } from '@kdp/shared';
import { AppError } from '../../common/errors/app-error.js';
import { getAIProvider } from '../ai/ai-provider.instance.js';
import { aiUsageService } from '../ai-usage/ai-usage.service.js';
import { findOwnedSection } from '../content-versions/content-version.service.js';
import { ContentVersionModel } from '../content-versions/content-version.model.js';

const alternativesSchema = z.object({ alternatives: z.array(z.string()) });

const EDIT_INSTRUCTIONS: Partial<Record<AssistantRequestInput['action'], string>> = {
  rewrite: 'Rewrite this content, preserving its meaning but improving the writing quality.',
  simplify: 'Rewrite this to be simpler and easier to understand, without losing the key meaning.',
  expand: 'Expand this with more detail, examples, or explanation, in the same voice.',
  shorten: 'Shorten this while preserving the key meaning.',
  improve: 'Improve the overall quality of this writing (flow, word choice, engagement).',
  exercises: 'Create 3-5 practice exercises for the reader based on this content.',
  questions: 'Create 3-5 comprehension questions for the reader based on this content.',
};

/**
 * The contextual assistant from §35. This is preview-only — it returns a
 * suggestion; nothing is persisted here. The caller (the editor) applies
 * the result into the draft and only creates a new ContentVersion when the
 * human explicitly saves (§14 — content is never silently overwritten).
 */
export const aiAssistantService = {
  async run(
    userId: string,
    projectId: string,
    chapterId: string,
    sectionId: string,
    input: AssistantRequestInput,
  ): Promise<AssistantResult> {
    const section = await findOwnedSection(userId, projectId, chapterId, sectionId);

    let targetText = input.selectedText?.trim();
    if (!targetText) {
      if (section.currentVersion === 0) {
        throw AppError.validation('This section has no content yet — write or generate content first.');
      }
      const current = await ContentVersionModel.findOne({ sectionId, versionNumber: section.currentVersion });
      targetText = current?.content ?? '';
    }
    if (!targetText) {
      throw AppError.validation('Nothing to operate on — select some text or provide content.');
    }

    const provider = getAIProvider();

    if (input.action === 'alternatives') {
      const result = await provider.generateStructuredData(
        `Generate ${input.count} distinct alternative versions of the following content:\n\n${targetText}`,
        alternativesSchema,
        { systemPrompt: 'You are a professional book editor offering the author distinct creative options.' },
      );
      await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'assistant_alternatives', result });
      return { kind: 'alternatives', alternatives: result.data.alternatives };
    }

    if (input.action === 'fact_check') {
      const result = await provider.analyzeContent(
        targetText,
        'factual accuracy — identify specific factual claims and flag any that cannot be confidently verified; never fabricate a source or citation',
      );
      await aiUsageService.record({ userId, projectId, provider: provider.name, operation: 'assistant_fact_check', result });
      return { kind: 'analysis', summary: result.data.summary, findings: result.data.findings };
    }

    if (input.action === 'custom' && !input.instruction) {
      throw AppError.validation('"instruction" is required for the custom action.');
    }
    if (input.action === 'age_appropriate' && !input.ageRange) {
      throw AppError.validation('"ageRange" is required for the age_appropriate action.');
    }

    // Template-interpolating a missing ageRange would still produce a truthy, non-empty
    // string ("...aged undefined.") — the explicit checks above are what actually guard
    // this, not a falsy-instruction check after the fact.
    const instruction =
      input.action === 'custom'
        ? input.instruction!
        : input.action === 'age_appropriate'
          ? `Rewrite this to be suitable for readers aged ${input.ageRange}.`
          : EDIT_INSTRUCTIONS[input.action]!;

    const result = await provider.editContent(targetText, instruction);
    await aiUsageService.record({ userId, projectId, provider: provider.name, operation: `assistant_${input.action}`, result });
    return { kind: 'text', text: result.text };
  },
};
