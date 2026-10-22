// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

export const DeleteSafeDelegateDtoSchema = z.object({
  delegate: AddressSchema,
  safe: AddressSchema,
  signature: HexSchema,
});
