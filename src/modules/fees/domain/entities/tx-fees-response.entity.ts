// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';

export type TxDataResponse = z.infer<typeof TxDataResponseSchema>;

export type RelayCost = z.infer<typeof RelayCostSchema>;

export type TxFeesResponse = z.infer<typeof TxFeesResponseSchema>;

export const TxDataResponseSchema = z.object({
  chainId: z.coerce
    .string()
    .pipe(NonNegativeNumericStringSchema)
    .refine((value) => value !== '0', { error: 'Invalid chain ID' }),
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
