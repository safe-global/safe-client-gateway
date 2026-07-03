// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { Origin } from '@/modules/fees/domain/entities/origin.entity';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export type GtfTxData = z.infer<typeof GtfTxDataSchema>;
export type GtfValuationDetail = z.infer<typeof GtfValuationDetailSchema>;
export type GtfFeeBreakdown = z.infer<typeof GtfFeeBreakdownSchema>;
export type GtfPricingContextSnapshot = z.infer<
  typeof GtfPricingContextSnapshotSchema
>;
export type GtfFeesResponse = z.infer<typeof GtfFeesResponseSchema>;

export const GtfTxDataSchema = z.object({
  chainId: z.coerce.string().regex(/^[1-9]\d*$/),
  safeAddress: AddressSchema,
  to: AddressSchema,
  value: z.string(),
  data: HexSchema,
  operation: z.enum(Operation),
  safeTxGas: z.string(),
  baseGas: z.string(),
  gasPrice: z.string(),
  gasToken: AddressSchema,
  refundReceiver: AddressSchema,
  nonce: z.string(),
});

export const GtfValuationDetailSchema = z.object({
  tokenAddress: AddressSchema.optional(),
  symbol: z.string(),
  amount: z.string(),
  priceUsd: z.number().optional(),
  valueUsd: z.number().optional(),
});

export const GtfFeeBreakdownSchema = z.object({
  txValueUsd: z.number(),
  trailingVolumeUsd: z.number(),
  tierBps: z.number(),
  gtfFeeUsd: z.number(),
  relayCostUsd: z.number(),
  totalUsd: z.number(),
  numberSignatures: z.number(),
  valuationDetails: z.array(GtfValuationDetailSchema),
});

export const GtfPricingContextSnapshotSchema = z.object({
  priceSource: z.enum(PriceSource),
  priceTimestamp: z.number(),
  gasPriceVolatilityBuffer: z.number(),
  tierBps: z.number(),
  origin: z.enum(Origin),
  maxFeeCapUsd: z.number(),
});

export const GtfFeesResponseSchema = z.object({
  safeTxHash: HexSchema,
  txData: GtfTxDataSchema,
  feeBreakdown: GtfFeeBreakdownSchema,
  pricingContextSnapshot: GtfPricingContextSnapshotSchema,
});
