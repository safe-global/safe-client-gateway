// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import { POLICY_CATALOGUE } from '@/modules/policies/domain/policy-catalogue.constants';
import { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
import { DEFAULT_POLICY_DEPLOYMENT } from '@/modules/policies/domain/policy-deployments.constants';
import { PolicyDeploymentsService } from '@/modules/policies/domain/policy-deployments.service';

const SEPOLIA_CHAIN_ID = '11155111';
const SEPOLIA_ALLOWANCE_MODULE = '0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134';

const mockConfigurationService = {
  get: vi.fn(),
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const mockLoggingService = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA_GUARD = getAddress(faker.finance.ethereumAddress());
const SEPOLIA_ERC20_POLICY = getAddress(faker.finance.ethereumAddress());

function createService(override?: string): PolicyCatalogueService {
  mockConfigurationService.get.mockImplementation((key: string) =>
    key === 'policies.deployments' ? override : undefined,
  );
  return new PolicyCatalogueService(
    new PolicyDeploymentsService(mockConfigurationService, mockLoggingService),
  );
}

/**
 * A chain whose addresses are pinned through `POLICY_ENGINE_DEPLOYMENTS`, which
 * replaces the default deployment for that chain rather than extending it.
 */
function createConfiguredService(): PolicyCatalogueService {
  return createService(
    JSON.stringify({
      [SEPOLIA_CHAIN_ID]: {
        safePolicyGuard: SEPOLIA_GUARD,
        policyContracts: { [PolicyType.Erc20Transfer]: SEPOLIA_ERC20_POLICY },
      },
    }),
  );
}

describe('PolicyCatalogueService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return the catalogue entries in order, with their copy', () => {
    const result = createService().get(SEPOLIA_CHAIN_ID);

    expect(result.map((policy) => policy.type)).toStrictEqual(
      POLICY_CATALOGUE.map((entry) => entry.type),
    );
    expect(result.map((policy) => policy.title)).toStrictEqual(
      POLICY_CATALOGUE.map((entry) => entry.title),
    );
    expect(result.map((policy) => policy.description)).toStrictEqual(
      POLICY_CATALOGUE.map((entry) => entry.description),
    );
  });

  it('should not expose the internal enforcementKind', () => {
    const [policy] = createService().get(SEPOLIA_CHAIN_ID);

    expect(policy).not.toHaveProperty('enforcementKind');
  });

  it('should report every policy as available, whatever the chain and configuration', () => {
    // `available` is a product decision that ships with the release, not a
    // function of which addresses CGW happens to know.
    for (const service of [createService(), createConfiguredService()]) {
      for (const chainId of [SEPOLIA_CHAIN_ID, faker.string.numeric(18)]) {
        expect(service.get(chainId).every((policy) => policy.available)).toBe(
          true,
        );
      }
    }
  });

  it('should flag the fallback policies', () => {
    const result = createService().get(SEPOLIA_CHAIN_ID);

    expect(
      result.filter((policy) => policy.isFallback).map((policy) => policy.type),
    ).toStrictEqual([
      PolicyType.AllowPolicy,
      PolicyType.NativeTransfer,
      PolicyType.Deny,
    ]);
  });

  it('should carry the module address inline for a module-enforced policy', () => {
    const result = createService().get(SEPOLIA_CHAIN_ID);

    const spendingLimit = result.find(
      (policy) => policy.type === PolicyType.SpendingLimit,
    );

    expect(spendingLimit).toMatchObject({
      enforcement: {
        via: PolicyEnforcementKind.Module,
        moduleAddress: SEPOLIA_ALLOWANCE_MODULE,
      },
    });
  });

  it('should carry the default guard and policy contract for an unconfigured chain', () => {
    const result = createService().get(SEPOLIA_CHAIN_ID);

    expect(
      result.find((policy) => policy.type === PolicyType.Erc20Transfer),
    ).toMatchObject({
      enforcement: {
        via: PolicyEnforcementKind.Guard,
        guards: {
          transactionGuard: {
            policyContract:
              DEFAULT_POLICY_DEPLOYMENT.policyContracts[
                PolicyType.Erc20Transfer
              ],
            safePolicyGuard: DEFAULT_POLICY_DEPLOYMENT.safePolicyGuard,
          },
        },
      },
    });
  });

  it.each([
    PolicyType.AllowPolicy,
    PolicyType.NativeTransfer,
    PolicyType.Deny,
  ])('should carry the deployment addresses of %s', (type) => {
    const result = createService().get(SEPOLIA_CHAIN_ID);

    expect(result.find((policy) => policy.type === type)).toMatchObject({
      enforcement: {
        via: PolicyEnforcementKind.Guard,
        guards: {
          transactionGuard: {
            policyContract: DEFAULT_POLICY_DEPLOYMENT.policyContracts[type],
            safePolicyGuard: DEFAULT_POLICY_DEPLOYMENT.safePolicyGuard,
          },
        },
      },
    });
  });

  it('should prefer the configured addresses of a chain over the defaults', () => {
    const result = createConfiguredService().get(SEPOLIA_CHAIN_ID);

    expect(
      result.find((policy) => policy.type === PolicyType.Erc20Transfer),
    ).toMatchObject({
      enforcement: {
        via: PolicyEnforcementKind.Guard,
        guards: {
          transactionGuard: {
            policyContract: SEPOLIA_ERC20_POLICY,
            safePolicyGuard: SEPOLIA_GUARD,
          },
        },
      },
    });
  });

  it('should report no enforcement for a type the configured chain does not name', () => {
    // The configured entry replaces the default one, so a type it omits has no
    // address to report - the entry is still offered.
    const result = createConfiguredService().get(SEPOLIA_CHAIN_ID);

    expect(
      result.find((policy) => policy.type === PolicyType.Cosigner),
    ).toMatchObject({ available: true, enforcement: null });
  });

  it('should report no enforcement for recovery until a Delay Modifier is configured', () => {
    const result = createService().get(SEPOLIA_CHAIN_ID);

    expect(
      result.find((policy) => policy.type === PolicyType.Recovery),
    ).toMatchObject({ available: true, enforcement: null });
  });

  it('should report no module enforcement on a chain without an AllowanceModule', () => {
    const result = createService().get(faker.string.numeric({ length: 18 }));

    expect(result).toHaveLength(POLICY_CATALOGUE.length);
    expect(
      result.find((policy) => policy.type === PolicyType.SpendingLimit)
        ?.enforcement,
    ).toBeNull();
    // The guard-enforced entries are deterministic addresses, so they resolve
    // on any chain.
    expect(
      result.find((policy) => policy.type === PolicyType.Erc20Transfer)
        ?.enforcement,
    ).not.toBeNull();
  });
});
