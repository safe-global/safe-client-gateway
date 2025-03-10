import { z } from 'zod';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export const CreateMessageDtoSchema = z.object({
  message: z.union([z.record(z.unknown()), z.string()]),
  safeAppId: z.number().int().gte(0).nullish().default(null),
  signature: SignatureSchema,
  origin: z.string().nullish().default(null),
});
