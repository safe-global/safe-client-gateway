// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { TypedDataSchema } from '@/modules/messages/domain/entities/typed-data.entity';
import {
  OriginNameSchema,
  OriginUrlSchema,
} from '@/modules/queue/entities/schemas/origin.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { HexBytesSchema } from '@/validation/entities/schemas/hexbytes.schema';
import { NullableHexSchema } from '@/validation/entities/schemas/nullable.schema';

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
  chainId: z.coerce.number(),
  safe: AddressSchema,
  message: z.union([z.string(), TypedDataSchema]),
  proposedBy: AddressSchema,
  preparedSignature: NullableHexSchema,
  originName: OriginNameSchema,
  originUrl: OriginUrlSchema,
  created: z.coerce.date(),
  modified: z.coerce.date(),
  confirmations: z.array(QueueMessageConfirmationSchema),
});

export const QueueMessagePageSchema = buildPageSchema(QueueMessageSchema);
