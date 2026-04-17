import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NullableAddressSchema } from '@/validation/entities/schemas/nullable.schema';

export const DelegateSchema = z.object({
  safe: NullableAddressSchema,
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
});

export const DelegatePageSchema = buildPageSchema(DelegateSchema);
