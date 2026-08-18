import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const sectionSchema = new Schema(
  {
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    order: { type: Number, required: true },
    /** 0 = no content generated yet. Points at the "current" ContentVersion — restoring an older version just moves this pointer, it never deletes anything (§14). */
    currentVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

sectionSchema.index({ chapterId: 1, order: 1 });

export type SectionDocument = HydratedDocument<InferSchemaType<typeof sectionSchema>>;

export const SectionModel = model('Section', sectionSchema);
