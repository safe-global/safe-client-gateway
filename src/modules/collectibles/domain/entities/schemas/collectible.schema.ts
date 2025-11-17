import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const CollectibleSchema = z.object({
  address: AddressSchema,
  tokenName: z.string(),
  tokenSymbol: z.string(),
  logoUri: z.string(),
  id: z.string(),
  // Don't enforce URL validation as some payloads otherwise fail
  uri: z.string().nullish().default(null),
  name: z.string().nullish().default(null),
  description: z.string().nullish().default(null),
  // Don't enforce URL validation as some payloads otherwise fail
  imageUri: z.string().nullish().default(null),
  metadata: z.record(z.unknown()).nullish().default(null),
});

export const CollectiblePageSchema = buildPageSchema(CollectibleSchema);
