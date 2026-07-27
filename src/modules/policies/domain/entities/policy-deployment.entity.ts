// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

/**
 * Policy-engine contract deployments for a single chain.
 *
 * - `safePolicyGuard`: the `SafePolicyGuard` deployment. Its presence is what
 *   makes guard-enforced policies available on the chain.
 * - `policyContracts`: the guard-enforced policy implementations, keyed by the
 *   {@link PolicyType} they implement.
 * - `moduleAddresses`: the module-enforced policy deployments. Only used for
 *   types whose deployment cannot be resolved from a Safe deployments package
 *   (see `PolicyDeploymentsService`).
 */
export const PolicyDeploymentSchema = z.object({
  safePolicyGuard: AddressSchema,
  policyContracts: z
    .object({
      [PolicyType.Erc20Transfer]: AddressSchema.optional(),
      [PolicyType.Cosigner]: AddressSchema.optional(),
    })
    .default({}),
  moduleAddresses: z
    .object({
      [PolicyType.SpendingLimit]: AddressSchema.optional(),
      [PolicyType.Recovery]: AddressSchema.optional(),
    })
    .default({}),
});

export type PolicyDeployment = z.infer<typeof PolicyDeploymentSchema>;

/**
 * Deployments keyed by chain ID.
 */
export const PolicyDeploymentsSchema = z.record(
  z.string(),
  PolicyDeploymentSchema,
);

export type PolicyDeployments = z.infer<typeof PolicyDeploymentsSchema>;
