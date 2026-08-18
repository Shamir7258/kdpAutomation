import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * Centralized prompt storage (§9) — controllers/services never inline
 * prompt strings; they fetch a named, active template and render it via
 * `AIProvider.generatePrompt(template, variables)`.
 */
const promptTemplateSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    version: { type: Number, required: true, default: 1 },
    description: { type: String, default: '' },
    systemPrompt: { type: String, required: true },
    userPrompt: { type: String, required: true },
    variables: { type: [String], default: [] },
    outputSchemaName: { type: String, default: null },
    model: { type: String, default: null },
    temperature: { type: Number, default: null },
    maxTokens: { type: Number, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type PromptTemplateDocument = HydratedDocument<InferSchemaType<typeof promptTemplateSchema>>;

export const PromptTemplateModel = model('PromptTemplate', promptTemplateSchema);
