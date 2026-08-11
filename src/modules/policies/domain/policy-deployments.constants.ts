// SPDX-License-Identifier: FSL-1.1-MIT
import { getAddress } from 'viem';
import type { PolicyDeployment } from '@/modules/policies/domain/entities/policy-deployment.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';

/**
 * The policy-engine deployment CGW reports when a chain is not configured.
 *
 * The addresses are deterministic (CREATE2), so the same deployment answers for
 * every chain the contracts are deployed to; a chain listed in
 * `POLICY_ENGINE_DEPLOYMENTS` overrides this entry wholesale.
 *
 * Only the `/policies` catalogue reads them - it names the contract that *would*
 * enforce a type the Safe has not configured yet. The addresses of policies
 * already configured on a Safe come from the Transaction Service's indexed
 * events, so `/policies/active` is unaffected by anything here, right or wrong.
 *
 * TODO: replace with safe-deployments once the policy-engine publishes its
 * deployments to a package CGW can read. Until then a chain without the
 * contracts deployed is reported with these addresses too, which makes a
 * configuration transaction revert rather than misreport state.
 */
export const DEFAULT_POLICY_DEPLOYMENT: PolicyDeployment = {
  safePolicyGuard: getAddress('0xde4c448904537EBBA654Ac3803E7D74A77C7a1a8'),
  policyContracts: {
    [PolicyType.Erc20Transfer]: getAddress(
      '0x37AB4Fd7eFaDfC6cc35e09196f74c19F163EdA43',
    ),
    [PolicyType.Cosigner]: getAddress(
      '0xC49f4786aF99b7c3Edf0A3F71E6B969B76302ca5',
    ),
    [PolicyType.AllowPolicy]: getAddress(
      '0x3e40e32CE2BC4aFF4D1A9BE293C119ce4Fb52eAc',
    ),
    [PolicyType.NativeTransfer]: getAddress(
      '0x77d29DEaE811D5E42fbe292d3f2729403e11cA3A',
    ),
    [PolicyType.Deny]: getAddress('0xA78478404a909d9Fc4A693ed6c91508d0E6a071a'),
  },
  // The Delay Modifier is deployed per Safe, so `recovery` has no single
  // address; a chain that has one configures it.
  moduleAddresses: {},
};

/**
 * Deployed alongside the above but not modelled in the catalogue yet. Kept so
 * that adding an entry needs no address hunt, and so the registry reads as the
 * whole deployment rather than a subset.
 *
 * - `AllowedModulePolicy`  0x8d2fA07068F55a1934C6A4EdE1C460C3d7D50e4A
 * - `ERC20ApprovePolicy`   0x2382b4680C610788eD9b00046c0f7F979F195575
 * - `MultiSendPolicy`      0x297127E77B51bB9E3F4a59E6b8Ac4d42f99CdAD5
 */
