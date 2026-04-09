// SPDX-License-Identifier: FSL-1.1-MIT
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { TypedDataSchema } from '@/modules/messages/domain/entities/typed-data.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import {
  NullableHexSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { z } from 'zod';

export type QueueMessageConfirmation = z.infer<
  typeof QueueMessageConfirmationSchema
>;

export type QueueMessage = z.infer<typeof QueueMessageSchema>;

export const QueueMessageConfirmationSchema = z.object({
  owner: AddressSchema,
  signature: HexBytesSchema,
  signatureType: z.enum(SignatureType),
  created: z.coerce.date(),
  modified: z.coerce.date(),
});

export const QueueMessageSchema = z.object({
  messageHash: HexSchema,
  chainId: z.number(),
  safe: AddressSchema,
  message: z.union([z.string(), TypedDataSchema]),
  proposedBy: AddressSchema,
  preparedSignature: NullableHexSchema,
  originName: NullableStringSchema,
  originUrl: NullableStringSchema,
  created: z.coerce.date(),
  modified: z.coerce.date(),
  confirmations: z.array(QueueMessageConfirmationSchema),
});

export const QueueMessagePageSchema = buildPageSchema(QueueMessageSchema);
