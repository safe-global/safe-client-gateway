import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const OrderSchema = z.object({
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  receiver: AddressSchema.nullish().default(null),
  sellAmount: NumericStringSchema,
  buyAmount: NumericStringSchema,
  validTo: z.number(),
  appData: z.string(),
  feeAmount: NumericStringSchema,
  kind: z.enum(['buy', 'sell', 'unknown']).default('unknown'),
  partiallyFillable: z.boolean(),
  sellTokenBalance: z
    .enum(['erc20', 'internal', 'external', 'unknown'])
    .default('unknown'),
  buyTokenBalance: z.enum(['erc20', 'internal', 'unknown']).default('unknown'),
  signingScheme: z
    .enum(['eip712', 'ethsign', 'presign', 'eip1271', 'unknown'])
    .default('unknown'),
  signature: z.string(),
  from: AddressSchema.nullish().default(null),
  quoteId: z.number().nullish().default(null),
  creationDate: z.coerce.date(),
  class: z.enum(['market', 'limit', 'liquidity', 'unknown']).default('unknown'),
  owner: AddressSchema,
  uid: z.string(),
  availableBalance: NumericStringSchema.nullish().default(null),
  executedSellAmount: NumericStringSchema,
  executedSellAmountBeforeFees: NumericStringSchema,
  executedBuyAmount: NumericStringSchema,
  executedFeeAmount: NumericStringSchema,
  invalidated: z.boolean(),
  status: z
    .enum([
      'presignaturePending',
      'open',
      'fulfilled',
      'cancelled',
      'expired',
      'unknown',
    ])
    .default('unknown'),
  fullFeeAmount: NumericStringSchema,
  isLiquidityOrder: z.boolean(),
  ethflowData: z
    .object({
      refundTxHash: z.string().nullish().default(null),
      userValidTo: z.number(),
    })
    .nullish()
    .default(null),
  onchainUser: AddressSchema.nullish().default(null),
  onchainOrderData: z
    .object({
      sender: AddressSchema,
      placementError: z
        .enum([
          'QuoteNotFound',
          'ValidToTooFarInFuture',
          'PreValidationError',
          'unknown',
        ])
        .default('unknown')
        .nullish()
        .default(null),
    })
    .nullish()
    .default(null),
  executedSurplusFee: NumericStringSchema.nullish().default(null),
  fullAppData: z.string().nullish().default(null),
});
