import { z } from 'zod';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';
import { MessageSchema } from '@/domain/messages/entities/message.entity';

export const CreateMessageDtoSchema = z.object({
  message: MessageSchema.shape.message,
  safeAppId: z.number().int().gte(0).nullish().default(null),
  signature: SignatureSchema,
  origin: z.string().nullish().default(null),
});
