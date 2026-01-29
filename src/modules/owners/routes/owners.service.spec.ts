import { OwnersService } from '@/modules/owners/routes/owners.service';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { SafesByChainId } from '@/modules/safe/domain/entities/safes-by-chain-id.entity';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';

interface ErrorWithStatus extends Error {
  status?: number;
}

const safeRepositoryMock: jest.MockedObjectDeep<ISafeRepository> = {
  getSafesByOwner: jest.fn(),
  getSafesByOwnerV2: jest.fn(),
  getAllSafesByOwner: jest.fn(),
  getAllSafesByOwnerV2: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>;

describe('OwnersService', () => {
  let service: OwnersService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new OwnersService(safeRepositoryMock);
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

    it('should handle empty safe list', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = { safes: [] };

      safeRepositoryMock.getSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(result).toEqual(mockResult);
      expect(result.safes).toHaveLength(0);
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

    it('should handle chains with null values (failed fetches)', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });

      const mockResult = {
        [chainId1]: [faker.finance.ethereumAddress()],
        [chainId2]: null,
      };

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(result[chainId2]).toBeNull();
    });

    it('should handle empty result for all chains', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = {};

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should propagate errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Failed to fetch chains');

      safeRepositoryMock.getAllSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwner({ ownerAddress }),
      ).rejects.toThrow('Failed to fetch chains');
    });
  });

  describe('getAllSafesByOwnerV2', () => {
    it('should call repository.getAllSafesByOwnerV2 with correct arguments', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const chainId3 = faker.string.numeric({
        exclude: [chainId1, chainId2],
      });

      const mockResult = {
        [chainId1]: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
        [chainId2]: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
        [chainId3]: [],
      };

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(safeRepositoryMock.getAllSafesByOwnerV2).toHaveBeenCalledTimes(1);
      expect(safeRepositoryMock.getAllSafesByOwnerV2).toHaveBeenCalledWith({
        ownerAddress,
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle chains with null values (failed fetches)', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const chainId3 = faker.string.numeric({
        exclude: [chainId1, chainId2],
      });

      const mockResult = {
        [chainId1]: [faker.finance.ethereumAddress()],
        [chainId2]: null,
        [chainId3]: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(result[chainId2]).toBeNull();
      expect(result[chainId1]).toHaveLength(1);
      expect(result[chainId3]).toHaveLength(2);
    });

    it('should handle all chains returning empty arrays', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });

      const mockResult = {
        [chainId1]: [],
        [chainId2]: [],
      };

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(result[chainId1]).toHaveLength(0);
      expect(result[chainId2]).toHaveLength(0);
    });

    it('should handle empty result for all chains', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = {};

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should propagate errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Failed to fetch chains V2');

      safeRepositoryMock.getAllSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Failed to fetch chains V2');
    });

    it('should handle mixed successful and failed chain fetches', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const chainId3 = faker.string.numeric({
        exclude: [chainId1, chainId2],
      });
      const chainId4 = faker.string.numeric({
        exclude: [chainId1, chainId2, chainId3],
      });

      const mockResult = {
        [chainId1]: [faker.finance.ethereumAddress()],
        [chainId2]: null,
        [chainId3]: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
        [chainId4]: null,
      };

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      const successfulChains = Object.values(result).filter(
        (v) => v !== null,
      ).length;
      const failedChains = Object.values(result).filter(
        (v) => v === null,
      ).length;

      expect(successfulChains).toBe(2);
      expect(failedChains).toBe(2);
    });
  });

  describe('Error Handling - getSafesByOwner', () => {
    it('should handle single safe in response', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = {
        safes: [faker.finance.ethereumAddress() as Address],
      };

      safeRepositoryMock.getSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwner({ chainId, ownerAddress });

      expect(result.safes).toHaveLength(1);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty safe list', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = { safes: [] };

      safeRepositoryMock.getSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwner({ chainId, ownerAddress });

      expect(result.safes).toHaveLength(0);
      expect(result).toEqual(mockResult);
    });

    it('should handle large number of safes', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const largeSafeList = Array.from({ length: 1000 }, () =>
        faker.finance.ethereumAddress(),
      ) as Array<Address>;
      const mockResult = { safes: largeSafeList };

      safeRepositoryMock.getSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwner({ chainId, ownerAddress });

      expect(result.safes).toHaveLength(1000);
      expect(result).toEqual(mockResult);
    });

    it('should propagate network timeout errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Network timeout');
      error.name = 'TimeoutError';

      safeRepositoryMock.getSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toThrow('Network timeout');
      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toHaveProperty('name', 'TimeoutError');
    });

    it('should propagate HTTP 404 errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error: ErrorWithStatus = new Error('Not Found');
      error.status = 404;

      safeRepositoryMock.getSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toThrow('Not Found');
    });

    it('should propagate HTTP 500 errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error: ErrorWithStatus = new Error('Internal Server Error');
      error.status = 500;

      safeRepositoryMock.getSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toThrow('Internal Server Error');
    });

    it('should handle service unavailable errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error: ErrorWithStatus = new Error('Service Unavailable');
      error.status = 503;

      safeRepositoryMock.getSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getSafesByOwner({ chainId, ownerAddress }),
      ).rejects.toThrow('Service Unavailable');
    });
  });

  describe('Error Handling - getSafesByOwnerV2', () => {
    it('should handle single safe in response', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult = {
        safes: [faker.finance.ethereumAddress() as Address],
      };

      safeRepositoryMock.getSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(result.safes).toHaveLength(1);
      expect(result).toEqual(mockResult);
    });

    it('should handle very large number of safes (pagination scenario)', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const largeSafeList = Array.from({ length: 2000 }, () =>
        faker.finance.ethereumAddress(),
      ) as Array<Address>;
      const mockResult = { safes: largeSafeList };

      safeRepositoryMock.getSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(result.safes).toHaveLength(2000);
      expect(result).toEqual(mockResult);
    });

    it('should propagate validation errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Invalid response schema');
      error.name = 'ZodError';

      safeRepositoryMock.getSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getSafesByOwnerV2({ chainId, ownerAddress }),
      ).rejects.toThrow('Invalid response schema');
    });

    it('should propagate rate limit errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error: ErrorWithStatus = new Error('Rate limit exceeded');
      error.status = 429;

      safeRepositoryMock.getSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getSafesByOwnerV2({ chainId, ownerAddress }),
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should propagate unauthorized errors', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error: ErrorWithStatus = new Error('Unauthorized');
      error.status = 401;

      safeRepositoryMock.getSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getSafesByOwnerV2({ chainId, ownerAddress }),
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Error Handling - getAllSafesByOwner', () => {
    it('should handle single chain with single safe', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = faker.string.numeric();

      const mockResult = {
        [chainId]: [faker.finance.ethereumAddress()],
      };

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.keys(result)).toHaveLength(1);
      expect(result[chainId]).toHaveLength(1);
    });

    it('should handle many chains with varying safe counts', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult: SafesByChainId = {};

      // Create 50 chains with unique IDs and varying numbers of safes
      for (let i = 0; i < 50; i++) {
        const chainId = `${i}`;
        const safeCount = faker.number.int({ min: 0, max: 20 });
        mockResult[chainId] = Array.from({ length: safeCount }, () =>
          faker.finance.ethereumAddress(),
        );
      }

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.keys(result)).toHaveLength(50);
    });

    it('should handle all chains returning null (all failed)', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const chainId3 = faker.string.numeric({
        exclude: [chainId1, chainId2],
      });

      const mockResult = {
        [chainId1]: null,
        [chainId2]: null,
        [chainId3]: null,
      };

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.values(result).every((v) => v === null)).toBe(true);
    });

    it('should handle all chains returning empty arrays', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });

      const mockResult = {
        [chainId1]: [],
        [chainId2]: [],
      };

      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwner({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(result[chainId1]).toHaveLength(0);
      expect(result[chainId2]).toHaveLength(0);
    });

    it('should propagate network errors', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Network error');
      error.name = 'NetworkError';

      safeRepositoryMock.getAllSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwner({ ownerAddress }),
      ).rejects.toThrow('Network error');
      await expect(
        service.getAllSafesByOwner({ ownerAddress }),
      ).rejects.toHaveProperty('name', 'NetworkError');
    });

    it('should propagate timeout errors', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Request timeout');
      error.name = 'TimeoutError';

      safeRepositoryMock.getAllSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwner({ ownerAddress }),
      ).rejects.toThrow('Request timeout');
    });

    it('should propagate config service errors', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error: ErrorWithStatus = new Error('Config service unavailable');
      error.status = 503;

      safeRepositoryMock.getAllSafesByOwner.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwner({ ownerAddress }),
      ).rejects.toThrow('Config service unavailable');
    });
  });

  describe('Error Handling - getAllSafesByOwnerV2', () => {
    it('should handle single chain with multiple safes', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId = faker.string.numeric();

      const mockResult = {
        [chainId]: [
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
          faker.finance.ethereumAddress(),
        ],
      };

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.keys(result)).toHaveLength(1);
      expect(result[chainId]).toHaveLength(3);
    });

    it('should handle many chains with large safe counts', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const mockResult: SafesByChainId = {};

      // Create 100 chains with unique IDs and varying numbers of safes
      for (let i = 0; i < 100; i++) {
        const chainId = `${i}`;
        const safeCount = faker.number.int({ min: 0, max: 50 });
        mockResult[chainId] = Array.from({ length: safeCount }, () =>
          faker.finance.ethereumAddress(),
        );
      }

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.keys(result)).toHaveLength(100);
    });

    it('should handle all chains returning null (total failure)', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const chainId3 = faker.string.numeric({
        exclude: [chainId1, chainId2],
      });

      const mockResult = {
        [chainId1]: null,
        [chainId2]: null,
        [chainId3]: null,
      };

      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue(mockResult);

      const result = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual(mockResult);
      expect(Object.values(result).every((v) => v === null)).toBe(true);
    });

    it('should propagate validation errors from repository', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Schema validation failed');
      error.name = 'ZodError';

      safeRepositoryMock.getAllSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Schema validation failed');
      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toHaveProperty('name', 'ZodError');
    });

    it('should propagate max sequential pages errors', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Max sequential pages limit reached');

      safeRepositoryMock.getAllSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Max sequential pages limit reached');
    });

    it('should propagate circuit breaker errors', async () => {
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const error = new Error('Circuit breaker open');
      error.name = 'CircuitBreakerError';

      safeRepositoryMock.getAllSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        service.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Circuit breaker open');
    });
  });

  describe('Edge Cases - Concurrent Calls', () => {
    it('should handle concurrent getSafesByOwner calls', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress1 = faker.finance.ethereumAddress() as Address;
      const ownerAddress2 = faker.finance.ethereumAddress() as Address;

      const mockResult1 = {
        safes: [faker.finance.ethereumAddress() as Address],
      };
      const mockResult2 = {
        safes: [faker.finance.ethereumAddress() as Address],
      };

      safeRepositoryMock.getSafesByOwner
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const [result1, result2] = await Promise.all([
        service.getSafesByOwner({ chainId, ownerAddress: ownerAddress1 }),
        service.getSafesByOwner({ chainId, ownerAddress: ownerAddress2 }),
      ]);

      expect(result1).toEqual(mockResult1);
      expect(result2).toEqual(mockResult2);
      expect(safeRepositoryMock.getSafesByOwner).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent getAllSafesByOwnerV2 calls', async () => {
      const ownerAddress1 = faker.finance.ethereumAddress() as Address;
      const ownerAddress2 = faker.finance.ethereumAddress() as Address;

      const mockResult1 = {
        '1': [faker.finance.ethereumAddress()],
      };
      const mockResult2 = {
        '2': [faker.finance.ethereumAddress()],
      };

      safeRepositoryMock.getAllSafesByOwnerV2
        .mockResolvedValueOnce(mockResult1)
        .mockResolvedValueOnce(mockResult2);

      const [result1, result2] = await Promise.all([
        service.getAllSafesByOwnerV2({ ownerAddress: ownerAddress1 }),
        service.getAllSafesByOwnerV2({ ownerAddress: ownerAddress2 }),
      ]);

      expect(result1).toEqual(mockResult1);
      expect(result2).toEqual(mockResult2);
      expect(safeRepositoryMock.getAllSafesByOwnerV2).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases - Boundary Values', () => {
    it('should handle zero safes across all methods', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;

      safeRepositoryMock.getSafesByOwner.mockResolvedValue({ safes: [] });
      safeRepositoryMock.getSafesByOwnerV2.mockResolvedValue({ safes: [] });
      safeRepositoryMock.getAllSafesByOwner.mockResolvedValue({});
      safeRepositoryMock.getAllSafesByOwnerV2.mockResolvedValue({});

      const result1 = await service.getSafesByOwner({ chainId, ownerAddress });
      const result2 = await service.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });
      const result3 = await service.getAllSafesByOwner({ ownerAddress });
      const result4 = await service.getAllSafesByOwnerV2({ ownerAddress });

      expect(result1.safes).toHaveLength(0);
      expect(result2.safes).toHaveLength(0);
      expect(Object.keys(result3)).toHaveLength(0);
      expect(Object.keys(result4)).toHaveLength(0);
    });

    it('should handle maximum safe count edge case', async () => {
      const chainId = faker.string.numeric();
      const ownerAddress = faker.finance.ethereumAddress() as Address;
      const maxSafes = Array.from({ length: 2500 }, () =>
        faker.finance.ethereumAddress(),
      ) as Array<Address>;

      safeRepositoryMock.getSafesByOwnerV2.mockResolvedValue({
        safes: maxSafes,
      });

      const result = await service.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(result.safes).toHaveLength(2500);
    });
  });
});
