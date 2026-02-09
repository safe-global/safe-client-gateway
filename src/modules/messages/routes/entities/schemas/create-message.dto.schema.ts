import { z } from 'zod';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';
import { MessageSchema } from '@/modules/messages/domain/entities/message.entity';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

export const CreateMessageDtoSchema = z.object({
  message: MessageSchema.shape.message,
  safeAppId: z.number().int().gte(0).nullish().default(null),
  signature: SignatureSchema,
  origin: NullableStringSchema,
});
