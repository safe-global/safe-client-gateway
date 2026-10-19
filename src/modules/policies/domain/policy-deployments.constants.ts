// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, getAddress, isAddressEqual } from 'viem';
import { PolicyType } from '#/modules/policies/domain/entities/policy-type.entity';

/**
 * The policy-engine contracts CGW recognises, as the policy indexer tracks
 * them. The guards differ only in their `DELAY`.
 */
const SAFE_POLICY_GUARDS: ReadonlyArray<Address> = [
  '0x2d4527fD0E79ca1e533E3C7BBEF7e0668b700aED',
  '0xd2fB492adADBa5BcFb7FeBE25746fd5FdE090b20',
  '0x5202B1ebE100812437d47eae769e155945fbba6a',
  '0x55c241591E12CE3c58491D02b737F12D3199ae95',
].map((address) => getAddress(address));

const POLICY_CONTRACTS: ReadonlyArray<{ type: PolicyType; address: Address }> =
  [
    {
      type: PolicyType.Allow,
      address: '0x92e94Af03982C2486dffa8DcBc5d069D33996eF2',
    },
    {
      type: PolicyType.Deny,
      address: '0x348d9F0B2fECb0bF88655C74Ed3eFD5052A9E436',
    },
    {
      type: PolicyType.Cosigner,
      address: '0xd9f2A31C5C68422a466754cd4F4965Be2b6024FB',
    },
    {
      type: PolicyType.Erc20Transfer,
      address: '0x25DDa3b8974a10E93ca188F9C149A42F938Bd187',
    },
    {
      type: PolicyType.MultiSend,
      address: '0xF933Ec646F9cd6Dd27Ae2f808D133D3f5847210c',
    },
    {
      type: PolicyType.NativeTransfer,
      address: '0x01b792988be451C5F6327b6e2D215Ff1d4cc7246',
    },
  ].map(({ type, address }) => ({ type, address: getAddress(address) }));

/** The chains the policy indexer tracks `SafePolicyGuard` on: Polygon and Sepolia. */
const POLICY_ENGINE_CHAIN_IDS: ReadonlySet<string> = new Set([
  '137',
  '11155111',
]);

/** The `SafePolicyGuard` deployments on the chain; none off the policy-engine chains. */
export function getSafePolicyGuardDeployments(chainId: string): Array<Address> {
  return POLICY_ENGINE_CHAIN_IDS.has(chainId) ? [...SAFE_POLICY_GUARDS] : [];
}

/** Whether {@link address} is a `SafePolicyGuard` deployment on the chain. */
export function isSafePolicyGuardDeployment(
  chainId: string,
  address: Address,
): boolean {
  return getSafePolicyGuardDeployments(chainId).some((guard) =>
    isAddressEqual(guard, address),
  );
}

/**
 * The policy type a policy contract on the chain enforces, or `null` for a
 * contract CGW does not know.
 */
export function getPolicyTypeOfContract(
  chainId: string,
  policyContract: Address,
): PolicyType | null {
  if (!POLICY_ENGINE_CHAIN_IDS.has(chainId)) {
    return null;
  }

  const match = POLICY_CONTRACTS.find((contract) =>
    isAddressEqual(contract.address, policyContract),
  );

  return match?.type ?? null;
}
