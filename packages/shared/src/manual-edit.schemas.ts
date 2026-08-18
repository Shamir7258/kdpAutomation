import { z } from 'zod';

export const saveManualEditSchema = z.object({
  content: z.string().min(1).max(200_000),
});
export type SaveManualEditInput = z.infer<typeof saveManualEditSchema>;
