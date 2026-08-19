import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from '@kdp/shared';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, default: 'user', required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', default: null },
    /** Admin-suspended accounts can't log in or refresh a session (checked at those two points,
     *  not on every request — see ARCHITECTURE.md §5 for why that's a deliberate tradeoff). */
    disabled: { type: Boolean, default: false, required: true },
  },
  { timestamps: true },
);

export type UserDocument = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const UserModel = model('User', userSchema);
