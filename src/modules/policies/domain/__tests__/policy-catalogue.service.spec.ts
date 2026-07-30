// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IFeatureFlagService } from '@/modules/chains/feature-flags/feature-flag.service.interface';
import {
  PolicyEnforcementKind,
  PolicyType,
} from '@/modules/policies/domain/entities/policy-type.entity';
import { POLICY_CATALOGUE } from '@/modules/policies/domain/policy-catalogue.constants';
import { PolicyCatalogueService } from '@/modules/policies/domain/policy-catalogue.service';
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

const mockFeatureFlagService = {
  isFeatureEnabled: vi.fn(),
} as MockedObject<IFeatureFlagService>;

const SEPOLIA_GUARD = getAddress(faker.finance.ethereumAddress());
const SEPOLIA_ERC20_POLICY = getAddress(faker.finance.ethereumAddress());

function createService(override?: string): PolicyCatalogueService {
  mockConfigurationService.get.mockImplementation((key: string) =>
    key === 'policies.deployments' ? override : undefined,
  );
  return new PolicyCatalogueService(
    new PolicyDeploymentsService(mockConfigurationService, mockLoggingService),
    mockFeatureFlagService,
  );
}

/**
 * Guard-enforced entries are only available once the chain's addresses are
 * configured: CGW ships none, deferring to the Transaction Service for the
 * addresses of policies that are already configured on a Safe.
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
    mockFeatureFlagService.isFeatureEnabled.mockResolvedValue(true);
  });

  it('should return the four catalogue entries in order, with their copy', async () => {
    const result = await createService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

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

  it('should not expose the internal enforcementKind', async () => {
    const [policy] = await createService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

    expect(policy).not.toHaveProperty('enforcementKind');
  });

  it('should carry the module address inline for a module-enforced policy', async () => {
    const result = await createService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

    const spendingLimit = result.find(
      (policy) => policy.type === PolicyType.SpendingLimit,
    );

    expect(spendingLimit).toMatchObject({
      available: true,
      enforcement: {
        via: PolicyEnforcementKind.Module,
        moduleAddress: SEPOLIA_ALLOWANCE_MODULE,
      },
    });
  });

  it('should carry the guard and policy contract inline for a guard-enforced policy', async () => {
    const result = await createConfiguredService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

    const allowlist = result.find(
      (policy) => policy.type === PolicyType.Erc20Transfer,
    );

    expect(allowlist).toMatchObject({
      available: true,
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

  it('should report guard-enforced policies as unavailable when no addresses are configured', async () => {
    // CGW ships no addresses, so an unconfigured deployment leaves the
    // guard-enforced entries unavailable even on a supported chain.
    const result = await createService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

    expect(
      result.find((policy) => policy.type === PolicyType.Erc20Transfer),
    ).toMatchObject({ available: false, enforcement: null });
  });

  it('should report a policy without a deployment as unavailable', async () => {
    const result = await createConfiguredService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

    // CoSignerPolicy and the Delay Modifier have no known address yet
    expect(
      result.find((policy) => policy.type === PolicyType.Cosigner),
    ).toMatchObject({ available: false, enforcement: null });
    expect(
      result.find((policy) => policy.type === PolicyType.Recovery),
    ).toMatchObject({ available: false, enforcement: null });
  });

  it('should report every policy as unavailable on a chain without deployments', async () => {
    const result = await createService().get({
      chainId: faker.string.numeric({ length: 18 }),
      configuredCounts: {},
    });

    expect(result).toHaveLength(POLICY_CATALOGUE.length);
    expect(result.every((policy) => !policy.available)).toBe(true);
    expect(result.every((policy) => policy.enforcement === null)).toBe(true);
  });

  it('should report every policy as unavailable when the feature flag is off', async () => {
    mockFeatureFlagService.isFeatureEnabled.mockResolvedValue(false);

    const result = await createConfiguredService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: {},
    });

    expect(result.every((policy) => !policy.available)).toBe(true);
    // the addresses are still reported so the wallet can explain what is gated
    expect(
      result.find((policy) => policy.type === PolicyType.Erc20Transfer)
        ?.enforcement,
    ).not.toBeNull();
  });

  it('should default a missing configuredCount to zero', async () => {
    const result = await createService().get({
      chainId: SEPOLIA_CHAIN_ID,
      configuredCounts: { [PolicyType.Erc20Transfer]: 3 },
    });

    expect(
      result.find((policy) => policy.type === PolicyType.Erc20Transfer)
        ?.configuredCount,
    ).toBe(3);
    expect(
      result.find((policy) => policy.type === PolicyType.Cosigner)
        ?.configuredCount,
    ).toBe(0);
  });
});
