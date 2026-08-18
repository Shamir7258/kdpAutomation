import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** One row per AI call (§28). Populated by aiUsageService.record(), called from every service that invokes the AIProvider. */
const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    provider: { type: String, required: true },
    model: { type: String, required: true },
    operation: { type: String, required: true },
    inputTokens: { type: Number, required: true },
    outputTokens: { type: Number, required: true },
    estimatedCostUsd: { type: Number, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type AIUsageDocument = HydratedDocument<InferSchemaType<typeof aiUsageSchema>>;

export const AIUsageModel = model('AIUsage', aiUsageSchema);
