import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One record per successful export bundle — append-only, same philosophy as Interior/Cover/
 * ContentVersion/EditPass (§14): regenerating never deletes a previous successful download.
 */
const exportSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: String, required: true },
    includedFiles: { type: [String], required: true },
    storageKey: { type: String, required: true },
    url: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
  },
  { timestamps: true },
);

exportSchema.index({ projectId: 1, createdAt: -1 });

export type ExportDocument = HydratedDocument<InferSchemaType<typeof exportSchema>>;

export const ExportModel = model('Export', exportSchema);
