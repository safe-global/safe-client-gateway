/**
 * These interfaces map Zerion responses for the list of wallet's fungible positions.
 * Reference documentation: https://developers.zerion.io/reference/listwalletpositions
 */

import { getAddress, isAddress } from 'viem';
import { z } from 'zod';

export type ZerionFungibleInfo = z.infer<typeof ZerionFungibleInfoSchema>;

export type ZerionImplementation = z.infer<typeof ZerionImplementationSchema>;

export type ZerionQuantity = z.infer<typeof ZerionQuantitySchema>;

export type ZerionFlags = z.infer<typeof ZerionFlagsSchema>;

export type ZerionAttributes = z.infer<typeof ZerionAttributesSchema>;

export type ZerionBalance = z.infer<typeof ZerionBalanceSchema>;

export type ZerionBalances = z.infer<typeof ZerionBalancesSchema>;

export const ZerionImplementationSchema = z.object({
  chain_id: z.string(),
  // Note: AddressSchema can't be used here because this field can contain non-eth addresses.
  address: z
    .string()
    .nullish()
    .default(null)
    .transform((value) =>
      value !== null && isAddress(value) ? getAddress(value) : value,
    ),
  decimals: z.number(),
});

export const ZerionFungibleInfoSchema = z.object({
  name: z.string().nullish().default(null),
  symbol: z.string().nullish().default(null),
  description: z.string().nullish().default(null),
  icon: z
    .object({
      url: z.string().nullish().default(null),
    })
    .nullish()
    .default(null),
  implementations: z.array(ZerionImplementationSchema),
});

export const ZerionQuantitySchema = z.object({
  int: z.string(),
  decimals: z.number(),
  float: z.number(),
  numeric: z.string(),
});

export const ZerionFlagsSchema = z.object({
  displayable: z.boolean(),
});

export const ZerionAttributesSchema = z.object({
  name: z.string(),
  quantity: ZerionQuantitySchema,
  value: z.number().nullish().default(null),
  price: z.number().nullish().default(null),
  fungible_info: ZerionFungibleInfoSchema,
  flags: ZerionFlagsSchema,
});

export const ZerionBalanceSchema = z.object({
  type: z.enum(['positions', 'unknown']).catch('unknown'),
  id: z.string(),
  attributes: ZerionAttributesSchema,
});

export const ZerionBalancesSchema = z.object({
  data: z.array(ZerionBalanceSchema),
});
