import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { PAPER_TYPES } from '@kdp/shared';

/**
 * One record per successful cover render — append-only, same philosophy as ContentVersion/
 * EditPass/Interior (§14): regenerating never deletes a previous successful download. The BullMQ
 * job's pending/running/failed lifecycle lives in the generic `Job` model; this collection only
 * ever gets a row once generation actually succeeds.
 */
const coverSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, required: true },
    paperType: { type: String, enum: PAPER_TYPES, required: true },
    pageCount: { type: Number, required: true },
    spineWidthIn: { type: Number, required: true },
    ebookCoverStorageKey: { type: String, required: true },
    ebookCoverUrl: { type: String, required: true },
    wrapCoverPdfStorageKey: { type: String, required: true },
    wrapCoverPdfUrl: { type: String, required: true },
  },
  { timestamps: true },
);

coverSchema.index({ projectId: 1, createdAt: -1 });

export type CoverDocument = HydratedDocument<InferSchemaType<typeof coverSchema>>;

export const CoverModel = model('Cover', coverSchema);
