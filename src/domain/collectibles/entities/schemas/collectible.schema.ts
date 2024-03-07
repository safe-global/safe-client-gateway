import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const CollectibleSchema = z.object({
  address: AddressSchema,
  tokenName: z.string(),
  tokenSymbol: z.string(),
  logoUri: z.string(),
  id: z.string(),
  // AJV remnant - do not use format: 'uri' as it fails on some payloads that should be considered valid
  uri: z.string().nullish().default(null),
  name: z.string().nullish().default(null),
  description: z.string().nullish().default(null),
  // AJV remnant - do not use format: 'uri' as it fails on some payloads that should be considered valid
  imageUri: z.string().nullish().default(null),
  metadata: z.record(z.unknown()).nullish().default(null),
});
