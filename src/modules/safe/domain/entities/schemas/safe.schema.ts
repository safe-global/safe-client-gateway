import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const SafeSchema = z.object({
  address: AddressSchema,
  nonce: CoercedNumberSchema,
  threshold: z.number(),
  owners: z.array(AddressSchema),
  masterCopy: AddressSchema,
  modules: z.array(AddressSchema).nullish().default(null),
  fallbackHandler: AddressSchema,
  guard: AddressSchema,
  version: z.string().nullish().default(null),
});

export const SafeSchemaV2 = z.object({
  address: AddressSchema,
  owners: z.array(AddressSchema),
  threshold: z.number(),
  nonce: CoercedNumberSchema,
  masterCopy: AddressSchema,
  fallbackHandler: AddressSchema,
  guard: AddressSchema.nullable(),
  moduleGuard: AddressSchema.nullable(),
  enabledModules: z.array(AddressSchema),
});

export const SafePageV2Schema = buildPageSchema(SafeSchemaV2);
