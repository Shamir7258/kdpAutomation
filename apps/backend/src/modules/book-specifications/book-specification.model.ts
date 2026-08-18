import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { LANGUAGES, READING_LEVELS, TRIM_SIZE_IDS } from '@kdp/shared';

/**
 * The canonical BookSpecification (§11) — every downstream generation stage
 * (outline, content, interior, cover) references this, not the raw idea.
 * One project has at most one specification (the workflow is: generate
 * ideas → pick one → create the spec once).
 */
const bookSpecificationSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ideaId: { type: Schema.Types.ObjectId, ref: 'BookIdea', required: true },
    workingTitle: { type: String, required: true },
    subtitle: { type: String, default: '' },
    audience: { type: String, default: '' },
    tone: { type: String, default: 'conversational' },
    readingLevel: { type: String, enum: READING_LEVELS, default: 'general' },
    language: { type: String, enum: LANGUAGES, default: 'en' },
    trimSizeId: { type: String, enum: TRIM_SIZE_IDS, default: '6x9' },
    estimatedPageCount: { type: Number, default: 0 },
    chapterCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type BookSpecificationDocument = HydratedDocument<InferSchemaType<typeof bookSpecificationSchema>>;

export const BookSpecificationModel = model('BookSpecification', bookSpecificationSchema);
