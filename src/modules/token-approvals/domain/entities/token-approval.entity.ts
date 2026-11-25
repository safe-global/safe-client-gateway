// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

export type TokenApproval = z.infer<typeof TokenApprovalSchema>;

export type TokenApprovals = z.infer<typeof TokenApprovalsSchema>;

/** A token and the spender a Safe approved for it, before the allowance is read. */
export type TokenSpender = z.infer<typeof TokenSpenderSchema>;

export const TokenSpenderSchema = z.object({
  tokenAddress: AddressSchema,
  spender: AddressSchema,
});

export const TokenApprovalSchema = TokenSpenderSchema.extend({
  allowance: z.bigint(),
});

export const TokenApprovalsSchema = z.object({
  approvals: z.array(TokenApprovalSchema),
  // False when the Safe has more history than the scan is allowed to read.
  isHistoryComplete: z.boolean(),
});
