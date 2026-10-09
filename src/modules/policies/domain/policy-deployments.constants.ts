// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, getAddress, isAddressEqual } from 'viem';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The policy-engine contracts CGW recognises.
 *
 * The addresses are deterministic (CREATE2), so the same set is used for every
 * chain. A chain without the contracts simply never matches them.
 *
 * TODO: replace with @safe-global/safe-modules-deployments once the
 * policy-engine publishes its deployments there.
 */
const POLICY_ENGINE_DEPLOYMENT: {
  safePolicyGuard: Address;
  policyContracts: ReadonlyArray<{ type: PolicyType; address: Address }>;
} = {
  safePolicyGuard: getAddress('0xde4c448904537EBBA654Ac3803E7D74A77C7a1a8'),
  policyContracts: [
    {
      type: PolicyType.Erc20Transfer,
      address: getAddress('0x37AB4Fd7eFaDfC6cc35e09196f74c19F163EdA43'),
    },
    {
      type: PolicyType.Cosigner,
      address: getAddress('0xC49f4786aF99b7c3Edf0A3F71E6B969B76302ca5'),
    },
    {
      type: PolicyType.Allow,
      address: getAddress('0x3e40e32CE2BC4aFF4D1A9BE293C119ce4Fb52eAc'),
    },
    {
      type: PolicyType.NativeTransfer,
      address: getAddress('0x77d29DEaE811D5E42fbe292d3f2729403e11cA3A'),
    },
    {
      type: PolicyType.Deny,
      address: getAddress('0xA78478404a909d9Fc4A693ed6c91508d0E6a071a'),
    },
  ],
};

/**
 * The `SafePolicyGuard` deployments on {@link chainId}.
 */
export function getSafePolicyGuardDeployments(
  _chainId: string,
): Array<Address> {
  return [POLICY_ENGINE_DEPLOYMENT.safePolicyGuard];
}

/**
 * The policy type a policy contract on {@link chainId} enforces, or `null` for a
 * contract CGW does not know.
 */
export function getPolicyTypeOfContract(
  _chainId: string,
  policyContract: Address,
): PolicyType | null {
  const match = POLICY_ENGINE_DEPLOYMENT.policyContracts.find((contract) =>
    isAddressEqual(contract.address, policyContract),
  );

  return match?.type ?? null;
}
