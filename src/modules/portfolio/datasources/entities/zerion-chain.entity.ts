import { z } from 'zod';

export type ZerionChain = z.infer<typeof ZerionChainSchema>;

export type ZerionChains = z.infer<typeof ZerionChainsSchema>;

export const ZerionChainAttributesSchema = z.object({
  external_id: z.string(),
  name: z.string(),
  icon: z
    .object({
      url: z.string(),
    })
    .nullish()
    .default(null),
});

export const ZerionChainSchema = z.object({
  type: z.string(),
  id: z.string(),
  attributes: ZerionChainAttributesSchema,
});

export const ZerionChainsSchema = z.object({
  data: z.array(ZerionChainSchema),
});
