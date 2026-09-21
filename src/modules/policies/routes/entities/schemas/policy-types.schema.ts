// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The policy types a request asks for, comma-separated:
 * `?types=spending-limit,proposer`.
 *
 * A type CGW does not report yet is still accepted - it names a real policy
 * kind, and answering "none of those" is the honest reply. Only a value that is
 * not a policy type at all is rejected, with a 422 naming it.
 */
export const PolicyTypesSchema = z
  .string()
  .transform((value) => value.split(','))
  .pipe(z.array(z.enum(PolicyType)).nonempty());

export type PolicyTypes = z.infer<typeof PolicyTypesSchema>;
