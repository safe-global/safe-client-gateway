import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { NullableAddressSchema } from '@/validation/entities/schemas/nullable.schema';

export const DelegateSchema = z.object({
  safe: NullableAddressSchema,
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
});

export const DelegatePageSchema = buildPageSchema(DelegateSchema);
