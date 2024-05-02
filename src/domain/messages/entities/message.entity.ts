import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { MessageConfirmationSchema } from '@/domain/messages/entities/message-confirmation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { z } from 'zod';

export type Message = z.infer<typeof MessageSchema>;

export const MessageSchema = z.object({
  created: z.coerce.date(),
  modified: z.coerce.date(),
  safe: AddressSchema,
  messageHash: HexSchema,
  message: z.union([z.string(), z.record(z.unknown())]),
  proposedBy: AddressSchema,
  safeAppId: z.number().nullish().default(null),
  confirmations: z.array(MessageConfirmationSchema),
  preparedSignature: HexSchema.nullish().default(null),
});

export const MessagePageSchema = buildPageSchema(MessageSchema);
