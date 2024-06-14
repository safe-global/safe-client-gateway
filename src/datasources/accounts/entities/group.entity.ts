import { z } from 'zod';

export type Group = z.infer<typeof GroupSchema>;

export const GroupSchema = z.object({
  id: z.number().int(),
});
