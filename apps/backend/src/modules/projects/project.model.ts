import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { BOOK_TYPE_IDS, LANGUAGES, PROJECT_STATUSES, WORKFLOW_STAGES } from '@kdp/shared';

const projectSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    name: { type: String, required: true, trim: true },
    bookType: { type: String, enum: BOOK_TYPE_IDS, required: true },
    niche: { type: String, required: true, trim: true },
    targetAudience: { type: String, default: '', trim: true },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    status: { type: String, enum: PROJECT_STATUSES, default: 'DRAFT', required: true, index: true },
    /** Per-stage status of the workflow engine (§26). Initialized 'pending' for every stage; populated for real from Phase 4. */
    workflowStatus: {
      type: Map,
      of: String,
      default: () => new Map(WORKFLOW_STAGES.map((stage) => [stage, 'pending'])),
    },
    archivedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

projectSchema.index({ userId: 1, name: 'text', niche: 'text' });
projectSchema.index({ userId: 1, updatedAt: -1 });

export type ProjectDocument = HydratedDocument<InferSchemaType<typeof projectSchema>>;

export const ProjectModel = model('Project', projectSchema);
