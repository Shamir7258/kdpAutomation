import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One canonical metadata doc per project (§ Phase 6). `POST` generates AI
 * suggestions and seeds the editable fields from them; `PATCH` lets the
 * publisher finalize title/keywords/categories/etc. Suggestions are kept
 * alongside the finalized fields so re-generating doesn't discard the human's
 * prior edits without them seeing what changed.
 */
const metadataSchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    subtitle: { type: String, default: '' },
    seriesName: { type: String, default: '' },
    seriesNumber: { type: Number },
    description: { type: String, required: true },
    keywords: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    authorName: { type: String, default: '' },
    primaryMarketplace: { type: String, default: 'amazon.com' },
    pricing: {
      type: new Schema({ currency: { type: String, default: 'USD' }, listPrice: { type: Number } }, { _id: false }),
      required: false,
    },
    aiSuggestions: {
      type: new Schema(
        {
          titles: { type: [String], default: [] },
          subtitles: { type: [String], default: [] },
          description: { type: String, default: '' },
          keywords: { type: [String], default: [] },
          categories: { type: [String], default: [] },
        },
        { _id: false },
      ),
      required: true,
    },
  },
  { timestamps: true },
);

export type MetadataDocument = HydratedDocument<InferSchemaType<typeof metadataSchema>>;

export const MetadataModel = model('Metadata', metadataSchema);
