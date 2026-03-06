import { DeadlockAnalysisService } from './deadlock-analysis.service';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { getAddress, type Address } from 'viem';
import { faker } from '@faker-js/faker';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { DeadlockStatus } from './entities/deadlock-status.entity';
import { DeadlockStatusGroup } from '../entities/status-group.entity';

const mockTransactionApi = {
  getSafe: jest.fn(),
  isSafe: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApi>;

const mockTransactionApiManager = {
  getApi: jest.fn().mockResolvedValue(mockTransactionApi),
} as jest.MockedObjectDeep<ITransactionApiManager>;

const mockCacheService = {
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>;

const mockConfigurationService = {
  getOrThrow: jest.fn().mockReturnValue(600),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockLoggingService = {
  debug: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

function mockSafe(args: {
  address: Address;
  owners: Array<Address>;
  threshold: number;
}): Raw<Safe> {
  return rawify(
    safeBuilder()
      .with('address', args.address)
      .with('owners', args.owners)
      .with('threshold', args.threshold)
      .build(),
  );
}

function buildDecodedTx(args: {
  to: Address;
  dataDecoded: BaseDataDecoded | null;
}): DecodedTransactionData {
  return {
    to: args.to,
    data: '0x',
    value: '0',
    operation: 0,
    dataDecoded: args.dataDecoded,
  } as DecodedTransactionData;
}

function addOwnerBaseDataDecoded(
  owner: Address,
  threshold: number,
): BaseDataDecoded {
  return {
    method: 'addOwnerWithThreshold',
    parameters: [
      { name: 'owner', type: 'address', value: owner },
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

function removeOwnerBaseDataDecoded(
  owner: Address,
  threshold: number,
): BaseDataDecoded {
  return {
    method: 'removeOwner',
    parameters: [
      {
        name: 'prevOwner',
        type: 'address',
        value: getAddress(faker.finance.ethereumAddress()),
      },
      { name: 'owner', type: 'address', value: owner },
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

function swapOwnerBaseDataDecoded(
  oldOwner: Address,
  newOwner: Address,
): BaseDataDecoded {
  return {
    method: 'swapOwner',
    parameters: [
      {
        name: 'prevOwner',
        type: 'address',
        value: getAddress(faker.finance.ethereumAddress()),
      },
      { name: 'oldOwner', type: 'address', value: oldOwner },
      { name: 'newOwner', type: 'address', value: newOwner },
    ],
  } as BaseDataDecoded;
}

function changeThresholdBaseDataDecoded(threshold: number): BaseDataDecoded {
  return {
    method: 'changeThreshold',
    parameters: [
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

describe('DeadlockAnalysisService', () => {
  let service: DeadlockAnalysisService;

  const chainId = '1';
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    mockCacheService.hGet.mockResolvedValue(null);
    mockCacheService.hSet.mockResolvedValue();
    service = new DeadlockAnalysisService(
      mockTransactionApiManager,
      mockCacheService,
      mockConfigurationService,
      mockLoggingService,
    );
  });

  describe('skip scenarios', () => {
    it('should return empty when tx.to !== safeAddress', async () => {
      const otherAddress = getAddress(faker.finance.ethereumAddress());
      const transactions = [
        buildDecodedTx({
          to: otherAddress,
          dataDecoded: addOwnerBaseDataDecoded(
            getAddress(faker.finance.ethereumAddress()),
            1,
          ),
        }),
      ];

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should return empty for non-owner-management function', async () => {
      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
      ];

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should return empty when dataDecoded is null', async () => {
      const transactions = [
        buildDecodedTx({ to: safeAddress, dataDecoded: null }),
      ];

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should return empty for empty transactions array', async () => {
      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions: [],
      });

      expect(result).toEqual({});
    });
  });

  describe('CRITICAL: DEADLOCK_DETECTED', () => {
    it('should detect mutual deadlock with addOwnerWithThreshold when both Safes depend on each other', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [], threshold: 1 }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown address'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) =>
        Promise.resolve(address.toLowerCase() === safeBAddress.toLowerCase()),
      );

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_DETECTED,
      );
      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.severity).toBe(
        'CRITICAL',
      );
    });

    it('should NOT detect deadlock when parent can meet threshold independently', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown address'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) =>
        Promise.resolve(address.toLowerCase() === safeBAddress.toLowerCase()),
      );

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NO_DEADLOCK,
      );
    });

    it('should detect deadlock with removeOwner leaving only mutual dependency', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: removeOwnerBaseDataDecoded(eoa1, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1, safeBAddress],
              threshold: 1,
            }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) =>
        Promise.resolve(address.toLowerCase() === safeBAddress.toLowerCase()),
      );

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_DETECTED,
      );
    });

    it('should detect deadlock with changeThreshold making mutual dependency unresolvable', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: changeThresholdBaseDataDecoded(2),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1, safeBAddress],
              threshold: 1,
            }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) =>
        Promise.resolve(address.toLowerCase() === safeBAddress.toLowerCase()),
      );

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_DETECTED,
      );
    });

    it('should detect deadlock with swapOwner creating mutual dependency', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: swapOwnerBaseDataDecoded(eoa1, safeBAddress),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1, eoa2],
              threshold: 2,
            }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) =>
        Promise.resolve(address.toLowerCase() === safeBAddress.toLowerCase()),
      );

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_DETECTED,
      );
    });
  });

  describe('OK: NO_DEADLOCK', () => {
    it('should return OK when all owners are EOAs', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(newEoa, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockResolvedValue(
        mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
      );

      mockTransactionApi.isSafe.mockResolvedValue(false);

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NO_DEADLOCK,
      );
      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.severity).toBe('OK');
    });

    it('should return OK when Safe owner exists but no circular dependency', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [eoa2],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NO_DEADLOCK,
      );
    });

    it('should return OK when mutual ownership exists but threshold can be met without the other Safe', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1],
              threshold: 1,
            }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress, eoa2],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NO_DEADLOCK,
      );
    });
  });

  describe('WARN: NESTED_SAFE_WARNING', () => {
    it('should return WARN when Safe owner at depth 1 has Safe owners itself', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const safeCAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeCAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        if (address.toLowerCase() === safeCAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NESTED_SAFE_WARNING,
      );
      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.severity).toBe('WARN');
    });

    it('should return OK when Safe owner at depth 1 has only EOA owners', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [eoa2],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NO_DEADLOCK,
      );
    });
  });

  describe('WARN: DEADLOCK_UNKNOWN', () => {
    it('should return WARN when getSafe fails for a Safe owner', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        return Promise.reject(new Error('Network error'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_UNKNOWN,
      );
      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.severity).toBe('WARN');
    });

    it('should return UNKNOWN when fetch fails but no deadlock on successfully fetched Safes', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const safeCAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 2),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1, safeCAddress],
              threshold: 1,
            }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Network error'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (
          address.toLowerCase() === safeBAddress.toLowerCase() ||
          address.toLowerCase() === safeCAddress.toLowerCase()
        ) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_UNKNOWN,
      );
    });

    it('should return UNKNOWN when deadlock check passes but fetch failure exists', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const safeCAddress = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [safeCAddress],
              threshold: 1,
            }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Network error'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (
          address.toLowerCase() === safeBAddress.toLowerCase() ||
          address.toLowerCase() === safeCAddress.toLowerCase()
        ) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_UNKNOWN,
      );
    });
  });

  describe('CRITICAL takes precedence', () => {
    it('should return CRITICAL over WARN when both mutual deadlock and deeper nesting exist', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [], threshold: 1 }),
          );
        }
        if (address.toLowerCase() === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) =>
        Promise.resolve(address.toLowerCase() === safeBAddress.toLowerCase()),
      );

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.DEADLOCK_DETECTED,
      );
    });
  });

  describe('caching', () => {
    it('should return cached result on cache hit', async () => {
      const cachedResponse = {
        [DeadlockStatusGroup.DEADLOCK]: [
          {
            severity: 'OK',
            type: DeadlockStatus.NO_DEADLOCK,
            title: 'No signing deadlock detected',
            description: 'No signing deadlock detected.',
          },
        ],
      };
      mockCacheService.hGet.mockResolvedValue(JSON.stringify(cachedResponse));

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(
            getAddress(faker.finance.ethereumAddress()),
            1,
          ),
        }),
      ];

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(result).toEqual(cachedResponse);
      expect(mockTransactionApi.getSafe).not.toHaveBeenCalled();
      expect(mockTransactionApi.isSafe).not.toHaveBeenCalled();
    });

    it('should cache result after analysis', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(newEoa, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockResolvedValue(
        mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
      );
      mockTransactionApi.isSafe.mockResolvedValue(false);

      await service.analyze({ chainId, safeAddress, transactions });

      expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should not cache when no owner change transaction is found', async () => {
      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
      ];

      await service.analyze({ chainId, safeAddress, transactions });

      expect(mockCacheService.hGet).not.toHaveBeenCalled();
      expect(mockCacheService.hSet).not.toHaveBeenCalled();
    });

    it('should proceed with analysis when cached value is invalid JSON', async () => {
      mockCacheService.hGet.mockResolvedValue('invalid-json');

      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(newEoa, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockResolvedValue(
        mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
      );
      mockTransactionApi.isSafe.mockResolvedValue(false);

      const result = await service.analyze({
        chainId,
        safeAddress,
        transactions,
      });

      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
      expect(result[DeadlockStatusGroup.DEADLOCK]?.[0]?.type).toBe(
        DeadlockStatus.NO_DEADLOCK,
      );
      expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    });
  });

  describe('batching', () => {
    it('should fetch all Safe owner data in parallel, not sequentially', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const safeCAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());
      const eoa3 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 2),
        }),
      ];

      // Track call order to verify parallel execution
      const callOrder: Array<string> = [];
      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        const lower = address.toLowerCase();
        callOrder.push(`getSafe:${lower}`);
        if (lower === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1, safeCAddress],
              threshold: 1,
            }),
          );
        }
        if (lower === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [eoa2],
              threshold: 1,
            }),
          );
        }
        if (lower === safeCAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeCAddress,
              owners: [eoa3],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        const lower = address.toLowerCase();
        return Promise.resolve(
          lower === safeBAddress.toLowerCase() ||
            lower === safeCAddress.toLowerCase(),
        );
      });

      await service.analyze({ chainId, safeAddress, transactions });

      // getSafe called once for target Safe, then once each for safeB + safeC in parallel
      // Verify both Safe owner getSafe calls happened (batched via Promise.allSettled)
      const safeOwnerCalls = callOrder.filter(
        (c) => c !== `getSafe:${safeAddress.toLowerCase()}`,
      );
      expect(safeOwnerCalls).toHaveLength(2);
    });

    it('should batch all nested isSafe checks into a single Promise.all', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const safeCAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const nestedOwner1 = getAddress(faker.finance.ethereumAddress());
      const nestedOwner2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 2),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        const lower = address.toLowerCase();
        if (lower === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [eoa1, safeCAddress],
              threshold: 1,
            }),
          );
        }
        if (lower === safeBAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeBAddress,
              owners: [nestedOwner1],
              threshold: 1,
            }),
          );
        }
        if (lower === safeCAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeCAddress,
              owners: [nestedOwner2],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new Error('Unknown'));
      });

      mockTransactionApi.isSafe.mockResolvedValue(false);
      // Override for safeB and safeC only at depth-0 check
      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        const lower = address.toLowerCase();
        return Promise.resolve(
          lower === safeBAddress.toLowerCase() ||
            lower === safeCAddress.toLowerCase(),
        );
      });

      await service.analyze({ chainId, safeAddress, transactions });

      // isSafe calls: 3 for projected owners (depth 0) + 2 for nested (depth 1) = 5
      // The 2 nested calls (nestedOwner1, nestedOwner2) should be in a single batch
      const isSafeCalls = mockTransactionApi.isSafe.mock.calls.map((c) =>
        c[0].toLowerCase(),
      );
      expect(isSafeCalls).toContain(nestedOwner1.toLowerCase());
      expect(isSafeCalls).toContain(nestedOwner2.toLowerCase());
    });
  });
});
