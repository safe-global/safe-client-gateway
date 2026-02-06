import { OwnersService } from '@/modules/owners/routes/owners.service';
import type { SafeRepository } from '@/modules/safe/domain/safe.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';

const safeRepositoryMock: jest.MockedObjectDeep<SafeRepository> = {
  getSafesByOwner: jest.fn(),
  getSafesByOwnerV2: jest.fn(),
  getAllSafesByOwner: jest.fn(),
  getAllSafesByOwnerV2: jest.fn(),
  getCreationTransaction: jest.fn(),
} as jest.MockedObjectDeep<SafeRepository>;

const loggingServiceMock: jest.MockedObjectDeep<ILoggingService> = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('OwnersService', () => {
  let service: OwnersService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OwnersService(safeRepositoryMock, loggingServiceMock);
  });

  describe('getSafesByOwner', () => {
    it('should call repository.getSafesByOwner with correct arguments', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockSafes = [
        faker.finance.ethereumAddress() as Address,
        faker.finance.ethereumAddress() as Address,
      ];
      const mockResult = { safes: mockSafes };

      safeRepositoryMock.getSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwner({ chainId, ownerAddress });

      expect(safeRepositoryMock.getSafesByOwner).toHaveBeenCalledTimes(1);
      expect(safeRepositoryMock.getSafesByOwner).toHaveBeenCalledWith({
        chainId,
        ownerAddress,
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from repository', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Repository error');

      safeRepositoryMock.getSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toThrow('Repository error');
    });
  });

  describe('getSafesByOwnerV2', () => {
    it('should call repository.getSafesByOwnerV2 with correct arguments', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockSafes = [
        faker.finance.ethereumAddress() as Address,
        faker.finance.ethereumAddress() as Address,
      ];
      const mockResult = { safes: mockSafes };

      safeRepositoryMock.getSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(safeRepositoryMock.getSafesByOwnerV2).toHaveBeenCalledTimes(1);
      expect(safeRepositoryMock.getSafesByOwnerV2).toHaveBeenCalledWith({
        chainId,
        ownerAddress,
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from repository', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Repository error V2');

      safeRepositoryMock.getSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getSafesByOwnerV2({ chainId, ownerAddress }),
      ).rejects.toThrow('Repository error V2');
    });
  });

  describe('getAllSafesByOwner', () => {
    it('should call repository.getAllSafesByOwner with correct arguments', async () => {
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

      expect(safeRepositoryMock.getAllSafesByOwner).toHaveBeenCalledTimes(1);
      expect(safeRepositoryMock.getAllSafesByOwner).toHaveBeenCalledWith({
        ownerAddress,
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Failed to fetch chains');

      safeRepositoryMock.getAllSafesByOwner.mockRejectedValue(error);

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
      expect(loggingServiceMock.warn).toHaveBeenCalledTimes(1);
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
      expect(loggingServiceMock.warn).toHaveBeenCalledTimes(1);
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
  });

  describe('getAllSafesByOwnerV2', () => {
    it('should call repository.getAllSafesByOwnerV2 with correct arguments', async () => {
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

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(safeRepositoryMock.getAllSafesByOwnerV2).toHaveBeenCalledTimes(1);
      expect(safeRepositoryMock.getAllSafesByOwnerV2).toHaveBeenCalledWith({
        ownerAddress,
      });
      expect(result).toEqual(mockResult);
    });

    it('should propagate errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Failed to fetch chains V2');

      safeRepositoryMock.getAllSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Failed to fetch chains V2');
    });
  });
});
