import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CONTENT_VERSION_SOURCES } from '@kdp/shared';

/**
 * Content is versioned, never overwritten (§14/§34). Every AI generation or
 * manual edit appends a new version; `Section.currentVersion` points at
 * whichever one is "live". Restoring an old version moves the pointer —
 * nothing is ever deleted here.
 */
const contentVersionSchema = new Schema(
  {
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    versionNumber: { type: Number, required: true },
    content: { type: String, required: true },
    source: { type: String, enum: CONTENT_VERSION_SOURCES, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

contentVersionSchema.index({ sectionId: 1, versionNumber: 1 }, { unique: true });

export type ContentVersionDocument = HydratedDocument<InferSchemaType<typeof contentVersionSchema>>;

export const ContentVersionModel = model('ContentVersion', contentVersionSchema);
