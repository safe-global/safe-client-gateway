// SPDX-License-Identifier: FSL-1.1-MIT

import type { z } from 'zod';
import type {
  PricingContextSnapshotSchema,
  TxDataResponseSchema,
  TxFeesResponseSchema,
} from '@/modules/fees/domain/entities/schemas/tx-fees-response.schema';

export type TxDataResponse = z.infer<typeof TxDataResponseSchema>;

export type PricingContextSnapshot = z.infer<
  typeof PricingContextSnapshotSchema
>;

export type TxFeesResponse = z.infer<typeof TxFeesResponseSchema>;
