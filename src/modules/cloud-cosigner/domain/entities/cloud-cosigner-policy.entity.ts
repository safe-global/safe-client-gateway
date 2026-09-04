// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { RowSchema } from '@/datasources/db/v2/entities/row.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const POLICY_INSTRUCTIONS_MAX_LENGTH = 4_000;

/**
 * The rules an owner set configures for the cloud cosigner of one Safe. A
 * Safe with no stored policy runs on the configured defaults.
 */
export const CloudCosignerPolicySchema = z.object({
  // Fiat value (in the configured fiat code) above which a transaction is
  // sent to full review instead of being signed on the fast path.
  valueThresholdUsd: z.number().int().nonnegative(),
  // Whether a first interaction with a contract the Safe has never executed
  // a transaction against goes to full review.
  reviewUnknownContracts: z.boolean(),
  // Free-text rules handed to the reviewer verbatim.
  instructions: z.string().max(POLICY_INSTRUCTIONS_MAX_LENGTH).nullable(),
});

export type CloudCosignerPolicy = z.infer<typeof CloudCosignerPolicySchema>;

export const SafeCloudCosignerPolicySchema = RowSchema.extend({
  chainId: z.string(),
  safeAddress: AddressSchema,
}).extend(CloudCosignerPolicySchema.shape);

export type SafeCloudCosignerPolicy = z.infer<
  typeof SafeCloudCosignerPolicySchema
>;
