import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const researchSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    nicheSummary: { type: String, required: true },
    audience: { type: String, default: '' },
    potentialTopics: { type: [String], default: [] },
    potentialSubtopics: { type: [String], default: [] },
    searchTerms: { type: [String], default: [] },
    competitorThemes: { type: [String], default: [] },
    contentOpportunities: { type: [String], default: [] },
    differentiationOpportunities: { type: [String], default: [] },
    riskWarnings: { type: [String], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type ResearchDocument = HydratedDocument<InferSchemaType<typeof researchSchema>>;

export const ResearchModel = model('Research', researchSchema);
