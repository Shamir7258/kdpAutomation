import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A refresh-token session. The raw refresh token is never stored — only
 * its sha256 hash — so a database read alone can't be used to impersonate
 * a user (mirrors password hashing practice). See ARCHITECTURE.md §2.3.
 */
const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDocument = HydratedDocument<InferSchemaType<typeof sessionSchema>>;

export const SessionModel = model('Session', sessionSchema);
