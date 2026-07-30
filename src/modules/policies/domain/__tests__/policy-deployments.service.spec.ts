// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
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

function createService(override?: string): PolicyDeploymentsService {
  mockConfigurationService.get.mockImplementation((key: string) =>
    key === 'policies.deployments' ? override : undefined,
  );
  return new PolicyDeploymentsService(
    mockConfigurationService,
    mockLoggingService,
  );
}

const SEPOLIA_GUARD = getAddress(faker.finance.ethereumAddress());
const SEPOLIA_ERC20_POLICY = getAddress(faker.finance.ethereumAddress());

/**
 * A service configured through `POLICY_ENGINE_DEPLOYMENTS`, the only source of
 * deployment addresses.
 */
function createConfiguredService(): PolicyDeploymentsService {
  return createService(
    JSON.stringify({
      [SEPOLIA_CHAIN_ID]: {
        safePolicyGuard: SEPOLIA_GUARD,
        policyContracts: { [PolicyType.Erc20Transfer]: SEPOLIA_ERC20_POLICY },
      },
    }),
  );
}

describe('PolicyDeploymentsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should know no chain until one is configured', () => {
    // CGW hardcodes no addresses: configured policies are typed and addressed
    // from the Transaction Service's indexed events, so a transcribed map would
    // only be a second source able to drift.
    expect(createService().getDeployment(SEPOLIA_CHAIN_ID)).toBeNull();
  });

  describe('isSupportedChain', () => {
    it('should support a chain configured with a SafePolicyGuard', () => {
      expect(createConfiguredService().isSupportedChain(SEPOLIA_CHAIN_ID)).toBe(
        true,
      );
    });

    it('should not support a chain without configuration', () => {
      expect(
        createService().isSupportedChain(faker.string.numeric({ length: 18 })),
      ).toBe(false);
    });

    it('should support no chain when nothing is configured', () => {
      expect(createService().isSupportedChain(SEPOLIA_CHAIN_ID)).toBe(false);
    });
  });

  describe('getSafePolicyGuard', () => {
    it('should return the configured guard address', () => {
      expect(
        createConfiguredService().getSafePolicyGuard(SEPOLIA_CHAIN_ID),
      ).toBe(SEPOLIA_GUARD);
    });

    it('should return null for an unconfigured chain', () => {
      expect(createConfiguredService().getSafePolicyGuard('1')).toBeNull();
    });
  });

  describe('getPolicyContract', () => {
    it('should return the configured ERC20TransferPolicy address', () => {
      expect(
        createConfiguredService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.Erc20Transfer,
        ),
      ).toBe(SEPOLIA_ERC20_POLICY);
    });

    it('should return null for a module-enforced type', () => {
      expect(
        createConfiguredService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.SpendingLimit,
        ),
      ).toBeNull();
    });

    it('should return null for a policy type without a configured address', () => {
      expect(
        createConfiguredService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.Cosigner,
        ),
      ).toBeNull();
    });

    it('should return null when nothing is configured for the chain', () => {
      expect(
        createService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.Erc20Transfer,
        ),
      ).toBeNull();
    });
  });

  describe('getModuleAddress', () => {
    it('should resolve the spending limit module from safe-modules-deployments', () => {
      expect(
        createService().getModuleAddress(
          SEPOLIA_CHAIN_ID,
          PolicyType.SpendingLimit,
        ),
      ).toBe(SEPOLIA_ALLOWANCE_MODULE);
    });

    it('should return null for a chain without an AllowanceModule', () => {
      expect(
        createService().getModuleAddress(
          faker.string.numeric({ length: 18 }),
          PolicyType.SpendingLimit,
        ),
      ).toBeNull();
    });

    it('should return null for recovery until a Delay Modifier address is known', () => {
      expect(
        createService().getModuleAddress(SEPOLIA_CHAIN_ID, PolicyType.Recovery),
      ).toBeNull();
    });

    it('should return the configured recovery module address', () => {
      const delayModifier = getAddress(faker.finance.ethereumAddress());
      const service = createService(
        JSON.stringify({
          [SEPOLIA_CHAIN_ID]: {
            safePolicyGuard: getAddress(faker.finance.ethereumAddress()),
            moduleAddresses: { [PolicyType.Recovery]: delayModifier },
          },
        }),
      );

      expect(
        service.getModuleAddress(SEPOLIA_CHAIN_ID, PolicyType.Recovery),
      ).toBe(delayModifier);
    });

    it('should return null for a guard-enforced type', () => {
      expect(
        createService().getModuleAddress(
          SEPOLIA_CHAIN_ID,
          PolicyType.Erc20Transfer,
        ),
      ).toBeNull();
    });
  });

  describe('configuration', () => {
    it('should add a chain', () => {
      const chainId = faker.string.numeric({ length: 6 });
      const safePolicyGuard = getAddress(faker.finance.ethereumAddress());
      const service = createService(
        JSON.stringify({ [chainId]: { safePolicyGuard } }),
      );

      expect(service.getSafePolicyGuard(chainId)).toBe(safePolicyGuard);
    });

    it('should configure several chains independently', () => {
      const other = faker.string.numeric({ length: 6 });
      const otherGuard = getAddress(faker.finance.ethereumAddress());
      const service = createService(
        JSON.stringify({
          [SEPOLIA_CHAIN_ID]: { safePolicyGuard: SEPOLIA_GUARD },
          [other]: { safePolicyGuard: otherGuard },
        }),
      );

      expect(service.getSafePolicyGuard(SEPOLIA_CHAIN_ID)).toBe(SEPOLIA_GUARD);
      expect(service.getSafePolicyGuard(other)).toBe(otherGuard);
    });

    it('should ignore and log a malformed configuration', () => {
      const service = createService('{not json');

      // Nothing to fall back to, so every chain is simply unsupported - but the
      // service must still come up rather than take the app down.
      expect(service.getSafePolicyGuard(SEPOLIA_CHAIN_ID)).toBeNull();
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid POLICY_ENGINE_DEPLOYMENTS, ignoring the override',
        }),
      );
    });

    it('should ignore and log an override with an invalid address', () => {
      const service = createService(
        JSON.stringify({ '1': { safePolicyGuard: 'not-an-address' } }),
      );

      expect(service.isSupportedChain('1')).toBe(false);
      expect(mockLoggingService.error).toHaveBeenCalled();
    });
  });
});
