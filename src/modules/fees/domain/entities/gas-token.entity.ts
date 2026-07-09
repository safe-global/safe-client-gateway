// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { buildLenientPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export type GasToken = z.infer<typeof GasTokenSchema>;

export const GasTokenSchema = z.object({
  address: AddressSchema,
  symbol: z.string(),
});

export const GasTokenLenientPageSchema = buildLenientPageSchema(GasTokenSchema);
