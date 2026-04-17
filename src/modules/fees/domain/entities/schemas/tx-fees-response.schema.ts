// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const TxDataResponseSchema = z.object({
  chainId: z.number(),
  safeAddress: AddressSchema,
  safeTxGas: z.string(),
  baseGas: z.string(),
  gasPrice: z.string(),
  gasToken: AddressSchema,
  refundReceiver: AddressSchema,
  numberSignatures: z.number(),
});

export const PricingContextSnapshotSchema = z.object({
  phase: z.number(),
  priceSource: z.enum(PriceSource),
  priceTimestamp: z.number(),
  gasVolatilityBuffer: z.number(),
});

export const TxFeesResponseSchema = z.object({
  txData: TxDataResponseSchema,
  relayCostUsd: z.number(),
  pricingContextSnapshot: PricingContextSnapshotSchema,
});
