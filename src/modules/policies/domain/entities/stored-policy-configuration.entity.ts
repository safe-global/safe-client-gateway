// SPDX-License-Identifier: FSL-1.1-MIT
import type { z } from 'zod';
import { PolicyConfigurationRequestSchema } from '#/modules/policies/domain/entities/policy-configuration-request.entity';

/**
 * The configurations CGW stored for one root of one Safe: what a root decodes
 * to, and the only source of `draft` items and their `createdAt`.
 */
export const SafePolicyGuardConfigurationSchema =
  PolicyConfigurationRequestSchema.pick({
    chainId: true,
    safeAddress: true,
    root: true,
    configurations: true,
    createdAt: true,
  });

export type StoredPolicyConfiguration = z.infer<
  typeof StoredPolicyConfigurationSchema
>;
