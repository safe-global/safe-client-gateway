// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import type {
  GtfFeeBreakdownSchema,
  GtfFeesResponseSchema,
  GtfPricingContextSnapshotSchema,
  GtfTxDataSchema,
  GtfValuationDetailSchema,
} from '@/modules/fees/domain/entities/schemas/gtf-fees-response.schema';

export type GtfTxData = z.infer<typeof GtfTxDataSchema>;
export type GtfValuationDetail = z.infer<typeof GtfValuationDetailSchema>;
export type GtfFeeBreakdown = z.infer<typeof GtfFeeBreakdownSchema>;
export type GtfPricingContextSnapshot = z.infer<
  typeof GtfPricingContextSnapshotSchema
>;
export type GtfFeesResponse = z.infer<typeof GtfFeesResponseSchema>;
