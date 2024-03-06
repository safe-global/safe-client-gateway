import { z } from 'zod';

export const CreateMessageDtoSchema = z.object({
  message: z.union([z.record(z.unknown()), z.string()]),
  safeAppId: z.number().nullable(),
  signature: z.string(),
});
