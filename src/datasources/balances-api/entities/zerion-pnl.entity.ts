import { z } from 'zod';

export const ZerionPnLAttributesSchema = z.object({
  realized_gain: z.number(),
  unrealized_gain: z.number(),
  total_fee: z.number(),
  net_invested: z.number(),
  received_external: z.number(),
  sent_external: z.number(),
  sent_for_nfts: z.number(),
  received_for_nfts: z.number(),
});

export const ZerionPnLDataSchema = z.object({
  type: z.literal('wallet_pnl'),
  id: z.string(),
  attributes: ZerionPnLAttributesSchema,
});

export const ZerionPnLResponseSchema = z.object({
  links: z.object({
    self: z.string(),
  }),
  data: ZerionPnLDataSchema,
});

export type ZerionPnLAttributes = z.infer<typeof ZerionPnLAttributesSchema>;
export type ZerionPnLData = z.infer<typeof ZerionPnLDataSchema>;
export type ZerionPnLResponse = z.infer<typeof ZerionPnLResponseSchema>;
