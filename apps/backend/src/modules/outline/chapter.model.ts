import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const chapterSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    order: { type: Number, required: true },
  },
  { timestamps: true },
);

chapterSchema.index({ projectId: 1, order: 1 });

export type ChapterDocument = HydratedDocument<InferSchemaType<typeof chapterSchema>>;

export const ChapterModel = model('Chapter', chapterSchema);
