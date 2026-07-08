// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { OwnersService } from '@/modules/owners/routes/owners.service';
import type { SafeRepository } from '@/modules/safe/domain/safe.repository';
import type { MaliciousAddressScanner } from '@/modules/safe-shield/malicious-address-scan/malicious-address-scanner.service';

const safeRepositoryMock: MockedObject<SafeRepository> = {
  getSafesByOwner: vi.fn(),
  getSafesByOwnerV2: vi.fn(),
  getAllSafesByOwner: vi.fn(),
  getAllSafesByOwnerV2: vi.fn(),
  getCreationTransaction: vi.fn(),
} as MockedObject<SafeRepository>;

const loggingServiceMock: MockedObject<ILoggingService> = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const getMaliciousAddresses = vi.fn();
const scannerMock = {
  getMaliciousAddresses,
} as unknown as MaliciousAddressScanner;

function buildService(maliciousFilterEnabled: boolean): OwnersService {
  const configurationServiceMock = {
    getOrThrow: vi.fn((key: string) => {
      if (key === 'features.ownersMaliciousFilter')
        return maliciousFilterEnabled;
      throw new Error(`Unexpected configuration key: ${key}`);
    }),
  } as unknown as IConfigurationService;
  return new OwnersService(
    safeRepositoryMock,
    loggingServiceMock,
    configurationServiceMock,
    scannerMock,
  );
}

describe('OwnersService', () => {
  let service: OwnersService;

  beforeEach(() => {
    vi.resetAllMocks();
    getMaliciousAddresses.mockResolvedValue(new Set<string>());
    service = buildService(false);
  });

  describe('getSafesByOwner (V1)', () => {
    it('should return the repository result unchanged when the filter is disabled', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = {
        safes: [
          faker.finance.ethereumAddress() as Address,
          faker.finance.ethereumAddress() as Address,
        ],
      };
      safeRepositoryMock.getSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwner({ chainId, ownerAddress });

      expect(result).toEqual(mockResult);
      expect(getMaliciousAddresses).not.toHaveBeenCalled();
    });

    it('should strip Blockaid-malicious safes when enabled, scanning only candidate safes', async () => {
      service = buildService(true);
      const chainId = '1';
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const safeA = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' as Address;
      const safeB = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' as Address;
      safeRepositoryMock.getSafesByOwner.mockResolvedValue({
        safes: [safeA, safeB],
      });
      getMaliciousAddresses.mockResolvedValue(new Set([safeA.toLowerCase()]));

      const result = await service.getSafesByOwner({ chainId, ownerAddress });

      expect(result).toEqual({ safes: [safeB] });
      expect(getMaliciousAddresses).toHaveBeenCalledWith(chainId, [
        safeA,
        safeB,
      ]);
    });

    it('should propagate errors from repository', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      safeRepositoryMock.getSafesByOwner.mockRejectedValue(
        new Error('Repository error'),
      );

      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toThrow('Repository error');
    });
  });

  describe('getAllSafesByOwner (V2)', () => {
    it('should pass through results when nothing is flagged', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const mockResult = {
        [chainId1]: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
        [chainId2]: [faker.finance.ethereumAddress()],
      };
      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      safeRepositoryMock.getAllSafesByOwner.mockRejectedValue(
        new Error('Failed to fetch chains'),
      );

      await expect(
        service.getAllSafesByOwner({ ownerAddress }),
      ).rejects.toThrow('Failed to fetch chains');
    });

    it('should filter out poisoned addresses (newer address removed)', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = '1';
      const legitimateAddress = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAbCd';
      const poisonedAddress = '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBaBcD';
      const unrelatedAddress = faker.finance.ethereumAddress();

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue({
        [chainId]: [legitimateAddress, poisonedAddress, unrelatedAddress],
      });

      safeRepositoryMock.getCreationTransaction.mockImplementation(
        ({ safeAddress }: { safeAddress: Address }) => {
          if (safeAddress === (legitimateAddress as Address)) {
            return Promise.resolve({
              created: new Date('2023-01-01'),
              creator: faker.finance.ethereumAddress() as Address,
              transactionHash: '0xabc' as `0x${string}`,
              factoryAddress: faker.finance.ethereumAddress() as Address,
              masterCopy: null,
              setupData: null,
              saltNonce: null,
            });
          }
          if (safeAddress === (poisonedAddress as Address)) {
            return Promise.resolve({
              created: new Date('2024-01-01'),
              creator: faker.finance.ethereumAddress() as Address,
              transactionHash: '0xdef' as `0x${string}`,
              factoryAddress: faker.finance.ethereumAddress() as Address,
              masterCopy: null,
              setupData: null,
              saltNonce: null,
            });
          }
          return Promise.reject(new Error('Unexpected address'));
        },
      );

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result[chainId]).toEqual([legitimateAddress, unrelatedAddress]);
    });

    it('should keep both addresses when creation date fetch fails', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = '1';
      const address1 = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAbCd';
      const address2 = '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBaBcD';

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue({
        [chainId]: [address1, address2],
      });
      safeRepositoryMock.getCreationTransaction.mockRejectedValue(
        new Error('Network error'),
      );

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result[chainId]).toEqual([address1, address2]);
      expect(loggingServiceMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('failed to fetch creation transactions'),
      );
    });

    it('should keep both addresses when creation dates are equal', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = '1';
      const address1 = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaAbCd';
      const address2 = '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbBaBcD';

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue({
        [chainId]: [address1, address2],
      });
      safeRepositoryMock.getCreationTransaction.mockResolvedValue({
        created: new Date('2023-01-01'),
        creator: faker.finance.ethereumAddress() as Address,
        transactionHash: '0xabc' as `0x${string}`,
        factoryAddress: faker.finance.ethereumAddress() as Address,
        masterCopy: null,
        setupData: null,
        saltNonce: null,
      });

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result[chainId]).toEqual([address1, address2]);
      expect(loggingServiceMock.warn).toHaveBeenCalledWith(
        expect.stringContaining('equal creation dates'),
      );
    });

    it('should pass through null chains', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = '1';

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue({
        [chainId]: null,
      });

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result[chainId]).toBeNull();
    });

    it('should strip the union of heuristic and Blockaid-malicious per chain', async () => {
      service = buildService(true);
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = '1';
      const keep = faker.finance.ethereumAddress();
      const blockaidMalicious = faker.finance.ethereumAddress();

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue({
        [chainId]: [keep, blockaidMalicious],
      });
      getMaliciousAddresses.mockResolvedValue(
        new Set([blockaidMalicious.toLowerCase()]),
      );

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result[chainId]).toEqual([keep]);
    });
  });

  describe('getAllSafesByOwnerV2 (V3)', () => {
    it('should pass through unchanged when the filter is disabled', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = { '1': [faker.finance.ethereumAddress()] };
      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(getMaliciousAddresses).not.toHaveBeenCalled();
    });

    it('should propagate errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      safeRepositoryMock.getAllSafesByOwnerV2.mockRejectedValue(
        new Error('Failed to fetch chains V2'),
      );

      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Failed to fetch chains V2');
    });

    it('should apply Blockaid-only stripping (no heuristic) when enabled', async () => {
      service = buildService(true);
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = '1';
      const keep = faker.finance.ethereumAddress();
      const malicious = faker.finance.ethereumAddress();

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue({
        [chainId]: [keep, malicious],
      });
      getMaliciousAddresses.mockResolvedValue(
        new Set([malicious.toLowerCase()]),
      );

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result[chainId]).toEqual([keep]);
      expect(safeRepositoryMock.getCreationTransaction).not.toHaveBeenCalled();
    });

    it('should keep strip scoping per chain (malicious on A, benign on B)', async () => {
      service = buildService(true);
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const shared = faker.finance.ethereumAddress();

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue({
        '1': [shared],
        '10': [shared],
      });
      getMaliciousAddresses.mockImplementation((chainId: string) =>
        Promise.resolve(
          chainId === '1' ? new Set([shared.toLowerCase()]) : new Set(),
        ),
      );

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result['1']).toEqual([]);
      expect(result['10']).toEqual([shared]);
    });

    it('should preserve null and empty chains when enabled', async () => {
      service = buildService(true);
      const ownerAddress = faker.finance.ethereumAddress() as Address;

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue({
        '1': null,
        '10': [],
      });

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result['1']).toBeNull();
      expect(result['10']).toEqual([]);
    });
  });
});
