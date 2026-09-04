// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export enum ReviewStatus {
  // Claimed by a worker; a stale PENDING row is reclaimed after a timeout.
  PENDING = 'PENDING',
  // The cosigner signed and posted its confirmation.
  APPROVED = 'APPROVED',
  // The cosigner withheld its signature.
  REJECTED = 'REJECTED',
  // Nothing to do: already confirmed, executed, or a stale nonce.
  SKIPPED = 'SKIPPED',
  // The review could not complete; the job is retried.
  FAILED = 'FAILED',
}

export enum ReviewMode {
  // No policy rule matched: signed without consulting the model.
  RULES = 'RULES',
  // At least one rule matched: the verdict came from the model.
  LLM = 'LLM',
}

export enum PolicyRule {
  VALUE_OVER_THRESHOLD = 'VALUE_OVER_THRESHOLD',
  UNKNOWN_VALUE = 'UNKNOWN_VALUE',
  UNKNOWN_CONTRACT = 'UNKNOWN_CONTRACT',
  DELEGATE_CALL = 'DELEGATE_CALL',
  SAFE_SETTINGS_CHANGE = 'SAFE_SETTINGS_CHANGE',
}

export const CloudCosignerReviewSchema = RowSchema.extend({
  chainId: z.string(),
  safeAddress: AddressSchema,
  safeTxHash: HexSchema,
  status: z.enum(ReviewStatus),
  mode: z.enum(ReviewMode).nullable(),
  triggeredRules: z.array(z.enum(PolicyRule)),
  summary: z.string().nullable(),
  riskFlags: z.array(z.string()),
  model: z.string().nullable(),
  signature: HexSchema.nullable(),
});

export type CloudCosignerReview = z.infer<typeof CloudCosignerReviewSchema>;

export const TERMINAL_REVIEW_STATUSES: ReadonlyArray<ReviewStatus> = [
  ReviewStatus.APPROVED,
  ReviewStatus.REJECTED,
  ReviewStatus.SKIPPED,
];
