// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

export const TransferBaseSchema = z.object({
  executionDate: z.coerce.date(),
  blockNumber: z.number(),
  transactionHash: HexSchema,
  to: AddressSchema,
  from: AddressSchema,
  transferId: z.string(),
});
