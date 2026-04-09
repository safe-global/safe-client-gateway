// SPDX-License-Identifier: FSL-1.1-MIT
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import {
  NullableAddressSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';
import { z } from 'zod';

export type QueueDelegate = z.infer<typeof QueueDelegateSchema>;

export const QueueDelegateSchema = z.object({
  delegate: AddressSchema,
  delegator: AddressSchema,
  chainId: z.number().nullable().default(null),
  safe: NullableAddressSchema,
  label: NullableStringSchema,
  created: z.coerce.date(),
  modified: z.coerce.date(),
});

export const QueueDelegatePageSchema = buildPageSchema(QueueDelegateSchema);
