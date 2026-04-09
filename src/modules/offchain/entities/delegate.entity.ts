// SPDX-License-Identifier: FSL-1.1-MIT
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import {
  NullableAddressSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { z } from 'zod';

export type OffchainDelegate = z.infer<typeof OffchainDelegateSchema>;

export const OffchainDelegateSchema = z.object({
  delegate: AddressSchema,
  delegator: AddressSchema,
  chainId: z.number().nullable().default(null),
  safe: NullableAddressSchema,
  label: NullableStringSchema,
  created: z.coerce.date(),
  modified: z.coerce.date(),
});

export const OffchainDelegatePageSchema = buildPageSchema(
  OffchainDelegateSchema,
);
