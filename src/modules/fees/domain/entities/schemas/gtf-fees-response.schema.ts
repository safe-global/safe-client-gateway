// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';
import { PriceSource } from '@/modules/fees/domain/entities/price-source.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

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
  numberSignatures: z.number(),
  nonce: z.string(),
});

export const GtfFeeSchema = z.object({
  fiatCode: z.string(),
  fiatValue: z.string(),
  tier: z.string(),
});

// phase is intentionally omitted — removed from fee-service responses per PLA-1675
export const GtfPricingContextSnapshotSchema = z.object({
  priceSource: z.enum(PriceSource),
  priceTimestamp: z.number(),
  gasPriceVolatilityBuffer: z.number(),
});

export const GtfFeesResponseSchema = z.object({
  txData: GtfTxDataSchema,
  safeTxHash: HexSchema,
  gtfFee: GtfFeeSchema,
  pricingContextSnapshot: GtfPricingContextSnapshotSchema,
});
