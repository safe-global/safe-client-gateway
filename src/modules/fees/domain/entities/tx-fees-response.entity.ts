// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ChainIdSchema } from '@/validation/entities/schemas/chain-id.schema';

export type TxDataResponse = z.infer<typeof TxDataResponseSchema>;

export type RelayCost = z.infer<typeof RelayCostSchema>;

export type TxFeesResponse = z.infer<typeof TxFeesResponseSchema>;

export const TxDataResponseSchema = z.object({
  chainId: ChainIdSchema,
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
