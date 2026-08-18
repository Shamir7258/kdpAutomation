import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { BOOK_IDEA_STATUSES } from '@kdp/shared';

const bookIdeaSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    targetAudience: { type: String, default: '' },
    problemSolved: { type: String, default: '' },
    uniqueAngle: { type: String, default: '' },
    estimatedPageCount: { type: Number, default: 0 },
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    contentType: { type: String, default: '' },
    differentiation: { type: String, default: '' },
    potentialRisks: { type: [String], default: [] },
    status: { type: String, enum: BOOK_IDEA_STATUSES, default: 'proposed', index: true },
  },
  { timestamps: true },
);

export type BookIdeaDocument = HydratedDocument<InferSchemaType<typeof bookIdeaSchema>>;

export const BookIdeaModel = model('BookIdea', bookIdeaSchema);
