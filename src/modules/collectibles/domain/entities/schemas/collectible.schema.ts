import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { NullableStringSchema } from '@/validation/entities/schemas/nullable.schema';

export const CollectibleSchema = z.object({
  address: AddressSchema,
  tokenName: z.string(),
  tokenSymbol: z.string(),
  logoUri: z.string(),
  id: z.string(),
  // Don't enforce URL validation as some payloads otherwise fail
  uri: NullableStringSchema,
  name: NullableStringSchema,
  description: NullableStringSchema,
  // Don't enforce URL validation as some payloads otherwise fail
  imageUri: NullableStringSchema,
  metadata: z.record(z.string(), z.unknown()).nullish().default(null),
});

export const CollectiblePageSchema = buildPageSchema(CollectibleSchema);
