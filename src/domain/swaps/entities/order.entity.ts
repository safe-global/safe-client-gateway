import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { FullAppDataSchema } from '@/domain/swaps/entities/full-app-data.entity';

export type Order = z.infer<typeof OrderSchema>;

export enum OrderStatus {
  PreSignaturePending = 'presignaturePending',
  Open = 'open',
  Fulfilled = 'fulfilled',
  Cancelled = 'cancelled',
  Expired = 'expired',
  Unknown = 'unknown',
}

export enum OrderClass {
  Market = 'market',
  Limit = 'limit',
  Liquidity = 'liquidity',
  Unknown = 'unknown',
}

export const OrderSchema = z.object({
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  receiver: AddressSchema.nullish().default(null),
  sellAmount: z.coerce.bigint(),
  buyAmount: z.coerce.bigint(),
  validTo: z.number(),
  appData: z.string(),
  feeAmount: z.coerce.bigint(),
  kind: z.enum(['buy', 'sell', 'unknown']).catch('unknown'),
  partiallyFillable: z.boolean(),
  sellTokenBalance: z
    .enum(['erc20', 'internal', 'external', 'unknown'])
    .catch('unknown'),
  buyTokenBalance: z.enum(['erc20', 'internal', 'unknown']).catch('unknown'),
  signingScheme: z
    .enum(['eip712', 'ethsign', 'presign', 'eip1271', 'unknown'])
    .catch('unknown'),
  signature: HexSchema,
  from: AddressSchema.nullish().default(null),
  quoteId: z.number().nullish().default(null),
  creationDate: z.coerce.date(),
  class: z.nativeEnum(OrderClass).catch(OrderClass.Unknown),
  owner: AddressSchema,
  uid: z.string(),
  availableBalance: z.coerce.bigint().nullish().default(null),
  executedSellAmount: z.coerce.bigint(),
  executedSellAmountBeforeFees: z.coerce.bigint(),
  executedBuyAmount: z.coerce.bigint(),
  executedFeeAmount: z.coerce.bigint(),
  invalidated: z.boolean(),
  status: z.nativeEnum(OrderStatus).catch(OrderStatus.Unknown),
  fullFeeAmount: z.coerce.bigint(),
  isLiquidityOrder: z.boolean(),
  ethflowData: z
    .object({
      refundTxHash: HexSchema.nullish().default(null),
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
        .catch('unknown')
        .nullish()
        .default(null),
    })
    .nullish()
    .default(null),
  executedSurplusFee: z.coerce.bigint().nullish().default(null),
  fullAppData: FullAppDataSchema.shape.fullAppData,
});
