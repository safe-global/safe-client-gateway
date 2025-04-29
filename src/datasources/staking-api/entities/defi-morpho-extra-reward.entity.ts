import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

// Note: only the used subset of fields returned by Kiln
export const DefiMorphoExtraRewardSchema = z.object({
  chain_id: z.number(),
  asset: AddressSchema,
  claimable: NumericStringSchema,
  claimable_next: NumericStringSchema,
});

export const DefiMorphoExtraRewardsSchema = z.array(
  DefiMorphoExtraRewardSchema,
);

export type DefiMorphoExtraReward = z.infer<typeof DefiMorphoExtraRewardSchema>;
