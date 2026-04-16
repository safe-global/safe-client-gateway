// SPDX-License-Identifier: FSL-1.1-MIT
import type {
  TxDataResponseSchema,
  PricingContextSnapshotSchema,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/schemas/tx-fees-response.schema';
import type { z } from 'zod';

export type TxDataResponse = z.infer<typeof TxDataResponseSchema>;

export type PricingContextSnapshot = z.infer<
  typeof PricingContextSnapshotSchema
>;

export type TxFeesResponse = z.infer<typeof TxFeesResponseSchema>;
