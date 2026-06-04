// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { MessageConfirmationSchema } from '@/modules/messages/domain/entities/message-confirmation.entity';
import { TypedDataSchema } from '@/modules/messages/domain/entities/typed-data.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import {
  NullableHexSchema,
  NullableNumberSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type Message = z.infer<typeof MessageSchema>;

export const MessageSchema = z.object({
  created: z.coerce.date(),
  modified: z.coerce.date(),
  safe: AddressSchema,
  messageHash: HexSchema,
  message: z.union([z.string(), TypedDataSchema]),
  proposedBy: AddressSchema,
  safeAppId: NullableNumberSchema,
  confirmations: z.array(MessageConfirmationSchema),
  preparedSignature: NullableHexSchema,
  origin: NullableStringSchema,
});

export const MessagePageSchema = buildPageSchema(MessageSchema);
