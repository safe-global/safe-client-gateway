import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { FullAppDataSchema } from '@/modules/swaps/domain/entities/full-app-data.entity';
import {
  NullableAddressSchema,
  NullableHexSchema,
  NullableNumberSchema,
} from '@/validation/entities/schemas/nullable.schema';

export type Order = z.infer<typeof OrderSchema>;

export type KnownOrder = Order & { kind: Exclude<Order['kind'], 'unknown'> };

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

export enum OrderKind {
  Buy = 'buy',
  Sell = 'sell',
  Unknown = 'unknown',
}

export enum SellTokenBalance {
  Erc20 = 'erc20',
  Internal = 'internal',
  External = 'external',
  Unknown = 'unknown',
}

export enum BuyTokenBalance {
  Erc20 = 'erc20',
  Internal = 'internal',
  Unknown = 'unknown',
}

export const OrderSchema = z.object({
  sellToken: AddressSchema,
  buyToken: AddressSchema,
  receiver: NullableAddressSchema,
  sellAmount: z.coerce.bigint(),
  buyAmount: z.coerce.bigint(),
  validTo: z.number(),
  appData: z.string(),
  feeAmount: z.coerce.bigint(),
  kind: z.enum(OrderKind).catch(OrderKind.Unknown),
  partiallyFillable: z.boolean(),
  sellTokenBalance: z.enum(SellTokenBalance).catch(SellTokenBalance.Unknown),
  buyTokenBalance: z.enum(BuyTokenBalance).catch(BuyTokenBalance.Unknown),
  signingScheme: z
    .enum(['eip712', 'ethsign', 'presign', 'eip1271', 'unknown'])
    .catch('unknown'),
  signature: HexSchema,
  from: NullableAddressSchema,
  quoteId: NullableNumberSchema,
  creationDate: z.coerce.date(),
  class: z.enum(OrderClass).catch(OrderClass.Unknown),
  owner: AddressSchema,
  uid: z.string(),
  availableBalance: z.coerce.bigint().nullish().default(null),
  executedSellAmount: z.coerce.bigint(),
  executedSellAmountBeforeFees: z.coerce.bigint(),
  executedBuyAmount: z.coerce.bigint(),
  executedFeeAmount: z.coerce.bigint(),
  invalidated: z.boolean(),
  status: z.enum(OrderStatus).catch(OrderStatus.Unknown),
  isLiquidityOrder: z.boolean(),
  ethflowData: z
    .object({
      refundTxHash: NullableHexSchema,
      userValidTo: z.number(),
    })
    .nullish()
    .default(null),
  onchainUser: NullableAddressSchema,
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
  executedFee: z.coerce.bigint(),
  executedFeeToken: AddressSchema,
  fullAppData: FullAppDataSchema.shape.fullAppData,
});

export const OrdersSchema = z.array(OrderSchema);
