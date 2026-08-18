import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { EDIT_PASS_TYPES } from '@kdp/shared';

const findingSchema = new Schema(
  {
    type: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    location: { type: String, default: null },
  },
  { _id: false },
);

/** One document per pass, per pipeline run — never merged, per §15 "store each pass separately". */
const editPassSchema = new Schema(
  {
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    passType: { type: String, enum: EDIT_PASS_TYPES, required: true },
    batchId: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    findings: { type: [findingSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type EditPassDocument = HydratedDocument<InferSchemaType<typeof editPassSchema>>;

export const EditPassModel = model('EditPass', editPassSchema);
