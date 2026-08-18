import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { INTERIOR_FORMATS } from '@kdp/document-engine';

/**
 * One record per successful interior render — append-only, same philosophy as ContentVersion/
 * EditPass (§14): regenerating never deletes a previous successful download. The BullMQ job's
 * pending/running/failed lifecycle lives in the generic `Job` model; this collection only ever
 * gets a row once generation actually succeeds.
 */
const interiorSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, required: true },
    format: { type: String, enum: INTERIOR_FORMATS, required: true },
    trimSizeId: { type: String, required: true },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    /** Only set for paginated formats (PDF) — see GeneratedInterior.pageCount in @kdp/document-engine. */
    pageCount: { type: Number },
  },
  { timestamps: true },
);

interiorSchema.index({ projectId: 1, createdAt: -1 });

export type InteriorDocument = HydratedDocument<InferSchemaType<typeof interiorSchema>>;

export const InteriorModel = model('Interior', interiorSchema);
