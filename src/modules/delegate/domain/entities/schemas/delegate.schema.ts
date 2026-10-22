// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { buildPageSchema } from '#/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import {
  NullableAddressSchema,
  NullableCoercedDateSchema,
} from '#/validation/entities/schemas/nullable.schema';

export const DelegateSchema = z.object({
  safe: NullableAddressSchema,
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
  // The Transaction Service does not report these; DelegatesV3Repository sets
  // them from the Queue Service.
  created: NullableCoercedDateSchema,
  modified: NullableCoercedDateSchema,
});

export const DelegatePageSchema = buildPageSchema(DelegateSchema);
