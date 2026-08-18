import { Types } from 'mongoose';
import { estimateCostUsd, type AIStructuredResult, type AITextResult } from '@kdp/ai';
import { AIUsageModel } from './ai-usage.model.js';

interface RecordUsageInput {
  userId: string;
  projectId?: string;
  provider: string;
  operation: string;
  result: AITextResult | AIStructuredResult<unknown>;
}

export const aiUsageService = {
  async record(input: RecordUsageInput): Promise<void> {
    await AIUsageModel.create({
      userId: input.userId,
      projectId: input.projectId ?? null,
      provider: input.provider,
      model: input.result.model,
      operation: input.operation,
      inputTokens: input.result.usage.inputTokens,
      outputTokens: input.result.usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(input.result.model, input.result.usage),
    });
  },

  async getSummary(userId: string): Promise<{ totalCostUsd: number; totalCalls: number }> {
    const [agg] = await AIUsageModel.aggregate<{ totalCostUsd: number; totalCalls: number }>([
      { $match: { userId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalCostUsd: { $sum: { $ifNull: ['$estimatedCostUsd', 0] } },
          totalCalls: { $sum: 1 },
        },
      },
    ]);
    return { totalCostUsd: agg?.totalCostUsd ?? 0, totalCalls: agg?.totalCalls ?? 0 };
  },
};
