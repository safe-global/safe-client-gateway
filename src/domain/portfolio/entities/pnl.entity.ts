import { z } from 'zod';

export const PnLSchema = z
  .object({
    realizedGain: z.number(),
    unrealizedGain: z.number(),
    totalFee: z.number(),
    netInvested: z.number(),
    receivedExternal: z.number(),
    sentExternal: z.number(),
    sentForNfts: z.number(),
    receivedForNfts: z.number(),
  })
  .nullable();

export type PnL = z.infer<typeof PnLSchema>;
