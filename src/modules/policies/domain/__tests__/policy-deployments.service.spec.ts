// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { POLICY_DEPLOYMENTS } from '@/modules/policies/domain/policy-deployments.constants';
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

describe('PolicyDeploymentsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('isSupportedChain', () => {
    it('should support a chain with a SafePolicyGuard deployment', () => {
      expect(createService().isSupportedChain(SEPOLIA_CHAIN_ID)).toBe(true);
    });

    it('should not support a chain without a deployment', () => {
      expect(
        createService().isSupportedChain(faker.string.numeric({ length: 18 })),
      ).toBe(false);
    });
  });

  describe('getSafePolicyGuard', () => {
    it('should return the guard address', () => {
      expect(createService().getSafePolicyGuard(SEPOLIA_CHAIN_ID)).toBe(
        POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].safePolicyGuard,
      );
    });

    it('should return null for an unsupported chain', () => {
      expect(createService().getSafePolicyGuard('1')).toBeNull();
    });
  });

  describe('getPolicyContract', () => {
    it('should return the ERC20TransferPolicy address', () => {
      expect(
        createService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.Erc20Transfer,
        ),
      ).toBe(
        POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].policyContracts[
          PolicyType.Erc20Transfer
        ],
      );
    });

    it('should return null for a module-enforced type', () => {
      expect(
        createService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.SpendingLimit,
        ),
      ).toBeNull();
    });

    it('should return null for a policy without a deployment', () => {
      // CoSignerPolicy is not deployed yet
      expect(
        createService().getPolicyContract(
          SEPOLIA_CHAIN_ID,
          PolicyType.Cosigner,
        ),
      ).toBeNull();
    });
  });

  describe('getPolicyType', () => {
    it('should resolve a policy address to its type', () => {
      const policy =
        POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].policyContracts[
          PolicyType.Erc20Transfer
        ]!;

      expect(createService().getPolicyType(SEPOLIA_CHAIN_ID, policy)).toBe(
        PolicyType.Erc20Transfer,
      );
    });

    it('should be case insensitive', () => {
      const policy =
        POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].policyContracts[
          PolicyType.Erc20Transfer
        ]!;

      expect(
        createService().getPolicyType(
          SEPOLIA_CHAIN_ID,
          policy.toLowerCase() as `0x${string}`,
        ),
      ).toBe(PolicyType.Erc20Transfer);
    });

    it('should return null for an unknown policy address', () => {
      expect(
        createService().getPolicyType(
          SEPOLIA_CHAIN_ID,
          getAddress(faker.finance.ethereumAddress()),
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

  describe('configuration override', () => {
    it('should add a chain that is not built in', () => {
      const chainId = faker.string.numeric({ length: 6 });
      const safePolicyGuard = getAddress(faker.finance.ethereumAddress());
      const service = createService(
        JSON.stringify({ [chainId]: { safePolicyGuard } }),
      );

      expect(service.getSafePolicyGuard(chainId)).toBe(safePolicyGuard);
      // built-in chains stay available
      expect(service.isSupportedChain(SEPOLIA_CHAIN_ID)).toBe(true);
    });

    it('should replace, not merge, a built-in chain entry', () => {
      const safePolicyGuard = getAddress(faker.finance.ethereumAddress());
      const service = createService(
        JSON.stringify({ [SEPOLIA_CHAIN_ID]: { safePolicyGuard } }),
      );

      expect(service.getSafePolicyGuard(SEPOLIA_CHAIN_ID)).toBe(
        safePolicyGuard,
      );
      expect(
        service.getPolicyContract(SEPOLIA_CHAIN_ID, PolicyType.Erc20Transfer),
      ).toBeNull();
    });

    it('should ignore and log a malformed override', () => {
      const service = createService('{not json');

      expect(service.getSafePolicyGuard(SEPOLIA_CHAIN_ID)).toBe(
        POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].safePolicyGuard,
      );
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
