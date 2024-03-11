import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const OrderSchema = z.object({
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  receiver: AddressSchema.optional().nullable().default(null),
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
  from: AddressSchema.optional().nullable().default(null),
  quoteId: z.number().optional().nullable().default(null),
  creationDate: z
    .string()
    .datetime()
    .transform((arg) => new Date(arg)),
  class: z.union([
    z.literal('market'),
    z.literal('limit'),
    z.literal('liquidity'),
  ]),
  owner: AddressSchema,
  uid: z.string(),
  availableBalance: NumericStringSchema.optional().nullable().default(null),
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
      refundTxHash: z.string().optional().nullable().default(null),
      userValidTo: z.number(),
    })
    .optional()
    .nullable()
    .default(null),
  onchainUser: AddressSchema.optional().nullable().default(null),
  onchainOrderData: z
    .object({
      sender: AddressSchema,
      placementError: z
        .union([
          z.literal('QuoteNotFound'),
          z.literal('ValidToTooFarInFuture'),
          z.literal('PreValidationError'),
        ])
        .optional()
        .nullable()
        .default(null),
    })
    .optional()
    .nullable()
    .default(null),
  executedSurplusFee: NumericStringSchema.optional().nullable().default(null),
  fullAppData: z.string().optional().nullable().default(null),
});
