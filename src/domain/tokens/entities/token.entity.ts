import { z } from 'zod';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * ERC-20 decimals are optional
 * @see https://eips.ethereum.org/EIPS/eip-20#decimals
 */
const DEFAULT_ERC20_DECIMALS = 0;
/**
 * ERC-721 decimals should return uint8(0) or be optional
 * @see https://eips.ethereum.org/EIPS/eip-721#backwards-compatibility
 */
const DEFAULT_ERC721_DECIMALS = 0;

const BaseTokenSchema = z.object({
  address: AddressSchema,
  logoUri: z.string().url(),
  name: z.string(),
  symbol: z.string(),
  trusted: z.boolean(),
});

const NativeTokenSchema = BaseTokenSchema.extend({
  type: z.literal('NATIVE_TOKEN'),
  decimals: z.number(),
});

const Erc20TokenSchema = BaseTokenSchema.extend({
  type: z.literal('ERC20'),
  decimals: z.number().catch(DEFAULT_ERC20_DECIMALS),
});

const Erc721TokenSchema = BaseTokenSchema.extend({
  type: z.literal('ERC721'),
  decimals: z.number().catch(DEFAULT_ERC721_DECIMALS),
});

export const TokenSchema = z.discriminatedUnion('type', [
  NativeTokenSchema,
  Erc20TokenSchema,
  Erc721TokenSchema,
]);

export const TokenPageSchema = buildPageSchema(TokenSchema);

export type NativeToken = z.infer<typeof NativeTokenSchema>;

export type Erc20Token = z.infer<typeof Erc20TokenSchema>;

export type Erc721Token = z.infer<typeof Erc721TokenSchema>;

export type Token = z.infer<typeof TokenSchema>;
