// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type {
  GtfFeeSchema,
  GtfFeesResponseSchema,
  GtfPricingContextSnapshotSchema,
  GtfTxDataSchema,
} from '@/modules/fees/domain/entities/schemas/gtf-fees-response.schema';

export type GtfTxData = z.infer<typeof GtfTxDataSchema>;
export type GtfFee = z.infer<typeof GtfFeeSchema>;
export type GtfPricingContextSnapshot = z.infer<
  typeof GtfPricingContextSnapshotSchema
>;
export type GtfFeesResponse = z.infer<typeof GtfFeesResponseSchema>;
