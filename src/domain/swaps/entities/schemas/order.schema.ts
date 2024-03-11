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
  kind: z.union([z.literal('buy'), z.literal('sell')]),
  partiallyFillable: z.boolean(),
  sellTokenBalance: z.union([
    z.literal('erc20'),
    z.literal('internal'),
    z.literal('external'),
  ]),
  buyTokenBalance: z.union([z.literal('erc20'), z.literal('internal')]),
  signingScheme: z.union([
    z.literal('eip712'),
    z.literal('ethsign'),
    z.literal('presign'),
    z.literal('eip1271'),
  ]),
  signature: z.string(),
  from: AddressSchema.nullish().default(null),
  quoteId: z.number().nullish().default(null),
  creationDate: z.coerce.date(),
  class: z.union([
    z.literal('market'),
    z.literal('limit'),
    z.literal('liquidity'),
  ]),
  owner: AddressSchema,
  uid: z.string(),
  availableBalance: NumericStringSchema.nullish().default(null),
  executedSellAmount: NumericStringSchema,
  executedSellAmountBeforeFees: NumericStringSchema,
  executedBuyAmount: NumericStringSchema,
  executedFeeAmount: NumericStringSchema,
  invalidated: z.boolean(),
  status: z.union([
    z.literal('presignaturePending'),
    z.literal('open'),
    z.literal('fulfilled'),
    z.literal('cancelled'),
    z.literal('expired'),
  ]),
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
        .union([
          z.literal('QuoteNotFound'),
          z.literal('ValidToTooFarInFuture'),
          z.literal('PreValidationError'),
        ])
        .nullish()
        .default(null),
    })
    .nullish()
    .default(null),
  executedSurplusFee: NumericStringSchema.nullish().default(null),
  fullAppData: z.string().nullish().default(null),
});
