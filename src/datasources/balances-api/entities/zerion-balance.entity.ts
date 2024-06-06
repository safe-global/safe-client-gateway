/**
 * These interfaces map Zerion responses for the list of wallet's fungible positions.
 * Reference documentation: https://developers.zerion.io/reference/listwalletpositions
 */

import { z } from 'zod';

export type ZerionFungibleInfo = z.infer<typeof ZerionFungibleInfoSchema>;

export type ZerionImplementation = z.infer<typeof ZerionImplementationSchema>;

export type ZerionQuantity = z.infer<typeof ZerionQuantitySchema>;

export type ZerionFlags = z.infer<typeof ZerionFlagsSchema>;

export type ZerionAttributes = z.infer<typeof ZerionAttributesSchema>;

export type ZerionBalance = z.infer<typeof ZerionBalanceSchema>;

export type ZerionBalances = z.infer<typeof ZerionBalancesSchema>;

const ZerionImplementationSchema = z.object({
  chain_id: z.string(),
  address: z.string().nullable(),
  decimals: z.number(),
});

const ZerionFungibleInfoSchema = z.object({
  name: z.string().nullable(),
  symbol: z.string().nullable(),
  description: z.string().nullable(),
  icon: z
    .object({
      url: z.string().nullable(),
    })
    .nullish()
    .default(null),
  implementations: z.array(ZerionImplementationSchema),
});

const ZerionQuantitySchema = z.object({
  int: z.string(),
  decimals: z.number(),
  float: z.number(),
  numeric: z.string(),
});

const ZerionFlagsSchema = z.object({
  displayable: z.boolean(),
});

const ZerionAttributesSchema = z.object({
  name: z.string(),
  quantity: ZerionQuantitySchema,
  value: z.number().nullable(),
  price: z.number(),
  fungible_info: ZerionFungibleInfoSchema,
  flags: ZerionFlagsSchema,
});

export const ZerionBalanceSchema = z.object({
  type: z.literal('positions'),
  id: z.string(),
  attributes: ZerionAttributesSchema,
});

export const ZerionBalancesSchema = z.object({
  data: z.array(ZerionBalanceSchema),
});
