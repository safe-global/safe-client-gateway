import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const DelegateSchema = z.object({
  safe: AddressSchema.nullish().default(null),
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
});

export const DelegatePageSchema = buildPageSchema(DelegateSchema);
