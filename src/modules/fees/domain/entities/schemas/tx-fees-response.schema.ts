// SPDX-License-Identifier: FSL-1.1-MIT

import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const TxDataResponseSchema = z.object({
  chainId: z.coerce.string().regex(/^[1-9]\d*$/),
  safeAddress: AddressSchema,
  safeTxGas: z.string(),
  baseGas: z.string(),
  gasPrice: z.string(),
  gasToken: AddressSchema,
  refundReceiver: AddressSchema,
  numberSignatures: z.number(),
});

export const RelayCostSchema = z.object({
  fiatCode: z.string(),
  fiatValue: z.string(),
});

export const TxFeesResponseSchema = z.object({
  txData: TxDataResponseSchema,
  relayCost: RelayCostSchema,
});
