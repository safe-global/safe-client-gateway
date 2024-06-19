import { z } from 'zod';

export type Row = z.infer<typeof RowSchema>;

export const RowSchema = z.object({
  id: z.number().int(),
  created_at: z.date(),
  updated_at: z.date(),
});
