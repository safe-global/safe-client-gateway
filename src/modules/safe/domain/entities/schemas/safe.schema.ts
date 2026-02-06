import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { CoercedNumberSchema } from '@/validation/entities/schemas/coerced-number.schema';
import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

const SafeBaseSchema = z.object({
  address: AddressSchema,
  nonce: CoercedNumberSchema,
  threshold: z.number(),
  owners: z.array(AddressSchema),
  masterCopy: AddressSchema,
  fallbackHandler: AddressSchema,
  guard: AddressSchema,
});

export const SafeSchema = SafeBaseSchema.extend({
  modules: z.array(AddressSchema).nullish().default(null),
  version: NullableStringSchema,
});

export const SafeSchemaV2 = SafeBaseSchema.extend({
  guard: AddressSchema.nullable(),
  moduleGuard: AddressSchema.nullable(),
  enabledModules: z.array(AddressSchema),
});

export const SafePageV2Schema = buildPageSchema(SafeSchemaV2);
