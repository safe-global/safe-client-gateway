// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { MessageSchema } from '@/modules/messages/domain/entities/message.entity';
import { MAX_ORIGIN_DTO_LENGTH } from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

export const CreateMessageDtoSchema = z.object({
  message: MessageSchema.shape.message,
  // Deprecated and ignored (see CreateMessageDto#safeAppId): the value is
  // never read downstream. Validation is best-effort only, so legacy clients
  // that still send a malformed/unexpected value aren't rejected because of
  // a field we don't act on — fall back to `null` instead of failing.
  safeAppId: z.number().int().gte(0).nullish().default(null).catch(null),
  signature: SignatureSchema,
  origin: z.string().max(MAX_ORIGIN_DTO_LENGTH).nullish().default(null),
});
