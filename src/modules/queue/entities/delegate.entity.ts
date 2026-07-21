// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { ChainIdSchema } from '@/modules/chains/domain/entities/schemas/chain-id.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import {
  NullableAddressSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type QueueServiceDelegate = z.infer<typeof QueueServiceDelegateSchema>;

export const QueueServiceDelegateSchema = z.object({
  delegate: AddressSchema,
  delegator: AddressSchema,
  chainId: ChainIdSchema,
  safe: NullableAddressSchema,
  label: NullableStringSchema,
  created: z.coerce.date(),
  modified: z.coerce.date(),
});

export const QueueServiceDelegatePageSchema = buildPageSchema(
  QueueServiceDelegateSchema,
);
