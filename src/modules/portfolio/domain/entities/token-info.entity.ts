import { z } from 'zod';
import { NullableAddressSchema } from '@/validation/entities/schemas/nullable.schema';

export const FiatStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const TokenInfoSchema = z.object({
  address: NullableAddressSchema,
  decimals: z.number(),
  symbol: z.string(),
  name: z.string(),
  logoUri: z.string(),
  chainId: z.string(),
  trusted: z.boolean(),
  type: z.enum(['ERC20', 'NATIVE_TOKEN']),
});

export type TokenInfo = z.infer<typeof TokenInfoSchema>;
