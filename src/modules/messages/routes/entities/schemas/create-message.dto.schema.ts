// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { MessageSchema } from '@/modules/messages/domain/entities/message.entity';
import { MAX_ORIGIN_DTO_LENGTH } from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export const CreateMessageDtoSchema = z.object({
  message: MessageSchema.shape.message,
  safeAppId: z.number().int().gte(0).nullish().default(null),
  signature: SignatureSchema,
  origin: z.string().max(MAX_ORIGIN_DTO_LENGTH).nullish().default(null),
});
