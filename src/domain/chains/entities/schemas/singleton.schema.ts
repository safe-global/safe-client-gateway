import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const SingletonSchema = z.object({
  address: AddressSchema,
  version: z.string(),
  deployer: AddressSchema,
  deployedBlockNumber: z.number(),
  lastIndexedBlockNumber: z.number(),
  l2: z.boolean(),
});
