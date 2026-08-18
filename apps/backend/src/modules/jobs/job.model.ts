import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const JOB_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

/**
 * Durable job record (§27/§13). BullMQ owns *execution* (Redis-backed
 * queue, retries, backoff); this collection is the queryable, permanent
 * record of what happened — BullMQ's own job data is housekeeping-pruned
 * (see `removeOnComplete`/`removeOnFail` in queues.ts) and isn't meant to
 * be queried directly by the app.
 */
const jobSchema = new Schema(
  {
    queueName: { type: String, required: true, index: true },
    bullJobId: { type: String, required: true },
    batchId: { type: String, required: true, index: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    chapterId: { type: Schema.Types.ObjectId, ref: 'Chapter', default: null },
    sectionId: { type: Schema.Types.ObjectId, ref: 'Section', default: null },
    status: { type: String, enum: JOB_STATUSES, default: 'pending', required: true, index: true },
    attempts: { type: Number, default: 0 },
    progress: { type: Number, default: 0 },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobSchema.index({ projectId: 1, createdAt: -1 });

export type JobDocument = HydratedDocument<InferSchemaType<typeof jobSchema>>;

export const JobModel = model('Job', jobSchema);
