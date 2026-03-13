// SPDX-License-Identifier: FSL-1.1-MIT
import { DeadlockAnalysisService } from './deadlock-analysis.service';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { getAddress, type Address } from 'viem';
import { faker } from '@faker-js/faker';
import { rawify, type Raw } from '@/validation/entities/raw.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import {
  addOwnerDecoded,
  removeOwnerDecoded,
  swapOwnerDecoded,
  changeThresholdDecoded,
} from './utils/__tests__/helpers/base-data-decoded.helpers';
import { DeadlockStatus } from '../entities/deadlock-status.entity';
import { CommonStatus } from '../entities/analysis-result.entity';
import { DeadlockStatusGroup } from '../entities/status-group.entity';
import {
  DEADLOCK_SEVERITY_MAPPING,
  DEADLOCK_TITLE_MAPPING,
  DEADLOCK_DESCRIPTION_MAPPING,
} from './deadlock-status.constants';
import type { DeadlockAnalysisResponse } from '../entities/analysis-responses.entity';
import { deadlockAnalysisResponseBuilder } from '../entities/__tests__/builders/analysis-responses.builder';
import { deadlockAnalysisResultBuilder } from '../entities/__tests__/builders/analysis-result.builder';

const mockTransactionApi = {
  getSafe: jest.fn(),
  isSafe: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApi>;

const mockTransactionApiManager = {
  getApi: jest.fn().mockResolvedValue(mockTransactionApi),
} as jest.MockedObjectDeep<ITransactionApiManager>;

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

function expectedResponse(
  safeAddress: Address,
  status: DeadlockStatus,
): DeadlockAnalysisResponse {
  return deadlockAnalysisResponseBuilder(false)
    .with(safeAddress, {
      [DeadlockStatusGroup.DEADLOCK]: [
        deadlockAnalysisResultBuilder()
          .with('type', status)
          .with('severity', DEADLOCK_SEVERITY_MAPPING[status])
          .with('title', DEADLOCK_TITLE_MAPPING[status])
          .with('description', DEADLOCK_DESCRIPTION_MAPPING[status]())
          .build(),
      ],
    })
    .build();
}

describe('DeadlockAnalysisService', () => {
  let service: DeadlockAnalysisService;
  let fakeCacheService: FakeCacheService;

  const chainId = '1';
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    fakeCacheService = new FakeCacheService();
    service = new DeadlockAnalysisService(
      mockTransactionApiManager,
      fakeCacheService,
      mockConfigurationService,
      mockLoggingService,
    );
  });

  afterEach(() => {
    fakeCacheService.clear();
  });

  describe('skip scenarios', () => {
    it('should analyze owner config transactions targeting other addresses', async () => {
      const otherAddress = getAddress(faker.finance.ethereumAddress());
      const existingOwner = getAddress(faker.finance.ethereumAddress());
      const newOwner = getAddress(faker.finance.ethereumAddress());
      const transactions = [
        buildDecodedTx({
          to: otherAddress,
          dataDecoded: addOwnerDecoded(newOwner, 1),
        }),
      ];

      // Mock getSafe for the target Safe
      mockTransactionApi.getSafe.mockResolvedValueOnce(
        mockSafe({
          address: otherAddress,
          owners: [existingOwner],
          threshold: 1,
        }),
      );
      // Mock getSafe for each projected owner — both are EOAs (404)
      mockTransactionApi.getSafe.mockRejectedValueOnce(
        new DataSourceError('Not found', 404),
      );
      mockTransactionApi.getSafe.mockRejectedValueOnce(
        new DataSourceError('Not found', 404),
      );

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // Owner config targeting otherAddress is analyzed — no deadlock (all owners are EOAs)
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
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should return empty for empty transactions array', async () => {
      const result = await service.analyze({
        chainId,
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
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });

    it('should NOT detect deadlock when parent can meet threshold independently', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should detect deadlock with removeOwner leaving only mutual dependency', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: removeOwnerDecoded(eoa1, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });

    it('should detect deadlock with changeThreshold making mutual dependency unresolvable', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: changeThresholdDecoded(2),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });

    it('should detect deadlock with swapOwner creating mutual dependency', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: swapOwnerDecoded(eoa1, safeBAddress),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });
  });

  describe('no deadlock (empty response)', () => {
    it('should return OK when all owners are EOAs', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(newEoa, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should return OK when Safe owner exists but no circular dependency', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should return OK when mutual ownership exists but threshold can be met without the other Safe', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
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
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      mockTransactionApi.isSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeCAddress.toLowerCase()) {
          return Promise.resolve(true);
        }
        return Promise.resolve(false);
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.NESTED_SAFE_WARNING),
      );
    });

    it('should return OK when Safe owner at depth 1 has only EOA owners', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      mockTransactionApi.isSafe.mockResolvedValue(false);

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
    });
  });

  describe('getSafe rejection handling', () => {
    describe('404 errors (not a Safe — treated as EOA)', () => {
      it('should return empty when all owners return 404', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const eoa1 = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
          return Promise.reject(new DataSourceError('Not found', 404));
        });

        const result = await service.analyze({
          chainId,
          transactions,
        });

        expect(result).toEqual({});
      });

      it('should skip 404 owners and still check remaining owners', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const safeCAddress = getAddress(faker.finance.ethereumAddress());
        const eoa1 = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 2),
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
          return Promise.reject(new DataSourceError('Not found', 404));
        });

        mockTransactionApi.isSafe.mockResolvedValue(false);

        const result = await service.analyze({
          chainId,
          transactions,
        });

        // safeCAddress 404 → EOA, skipped
        // safeBAddress fulfilled but no deadlock (targetNonDependent >= threshold)
        expect(result).toEqual({});
      });

      it('should still detect deadlock when some owners return 404', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const safeCAddress = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 2),
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
          return Promise.reject(new DataSourceError('Not found', 404));
        });

        const result = await service.analyze({
          chainId,
          transactions,
        });

        expect(result).toEqual(
          expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
        );
      });
    });

    describe('non-404 errors (API failure)', () => {
      it('should return NESTED_SAFE_WARNING when getSafe fails with non-404 error for all owners', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const eoa1 = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 1),
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
          return Promise.reject(
            new DataSourceError('Service unavailable', 503),
          );
        });

        const result = await service.analyze({
          chainId,
          transactions,
        });

        expect(result).toEqual(
          expectedResponse(safeAddress, DeadlockStatus.NESTED_SAFE_WARNING),
        );
      });

      it('should return NESTED_SAFE_WARNING when some owners fail with API error and no deadlock from fulfilled', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const safeCAddress = getAddress(faker.finance.ethereumAddress());
        const eoa1 = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 2),
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
                owners: [eoa1],
                threshold: 1,
              }),
            );
          }
          // safeCAddress fails with API error
          return Promise.reject(
            new DataSourceError('Service unavailable', 503),
          );
        });

        mockTransactionApi.isSafe.mockResolvedValue(false);

        const result = await service.analyze({
          chainId,
          transactions,
        });

        expect(result).toEqual(
          expectedResponse(safeAddress, DeadlockStatus.NESTED_SAFE_WARNING),
        );
      });

      it('should return NESTED_SAFE_WARNING when deadlock would exist but API failure occurred', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const safeCAddress = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 2),
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
          // safeCAddress fails with API error
          return Promise.reject(
            new DataSourceError('Service unavailable', 503),
          );
        });

        const result = await service.analyze({
          chainId,
          transactions,
        });

        // API failure short-circuits to NESTED_SAFE_WARNING — can't trust partial analysis
        expect(result).toEqual(
          expectedResponse(safeAddress, DeadlockStatus.NESTED_SAFE_WARNING),
        );
      });

      it('should return NESTED_SAFE_WARNING for mixed 404 + API error when no deadlock from fulfilled', async () => {
        const safeBAddress = getAddress(faker.finance.ethereumAddress());
        const eoa1 = getAddress(faker.finance.ethereumAddress());
        const eoa2 = getAddress(faker.finance.ethereumAddress());

        const transactions = [
          buildDecodedTx({
            to: safeAddress,
            dataDecoded: addOwnerDecoded(safeBAddress, 1),
          }),
        ];

        mockTransactionApi.getSafe.mockImplementation((address: Address) => {
          if (address.toLowerCase() === safeAddress.toLowerCase()) {
            return Promise.resolve(
              mockSafe({
                address: safeAddress,
                owners: [eoa1, eoa2],
                threshold: 1,
              }),
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
          if (address.toLowerCase() === eoa1.toLowerCase()) {
            // eoa1: 404 → not a Safe
            return Promise.reject(new DataSourceError('Not found', 404));
          }
          // eoa2: API failure
          return Promise.reject(
            new DataSourceError('Service unavailable', 503),
          );
        });

        mockTransactionApi.isSafe.mockResolvedValue(false);

        const result = await service.analyze({
          chainId,
          transactions,
        });

        // eoa2 has API failure → short-circuits to NESTED_SAFE_WARNING
        expect(result).toEqual(
          expectedResponse(safeAddress, DeadlockStatus.NESTED_SAFE_WARNING),
        );
      });
    });
  });

  describe('caching', () => {
    it('should return cached result on cache hit', async () => {
      const newOwner = getAddress(faker.finance.ethereumAddress());
      const ownerConfigs = [addOwnerDecoded(newOwner, 1)];
      const transactions = [
        buildDecodedTx({ to: safeAddress, dataDecoded: ownerConfigs[0] }),
      ];

      const cachedResponse = {};
      const cacheDir = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: ownerConfigs,
      });
      await fakeCacheService.hSet(
        cacheDir,
        JSON.stringify(cachedResponse),
        600,
      );

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(cachedResponse);
      expect(mockTransactionApi.getSafe).not.toHaveBeenCalled();
      expect(mockTransactionApi.isSafe).not.toHaveBeenCalled();
    });

    it('should cache result after analysis', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());
      const ownerConfigs = [addOwnerDecoded(newEoa, 1)];

      const transactions = [
        buildDecodedTx({ to: safeAddress, dataDecoded: ownerConfigs[0] }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      await service.analyze({ chainId, transactions });

      const cacheDir = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: ownerConfigs,
      });
      const cached = await fakeCacheService.hGet(cacheDir);
      expect(cached).not.toBeNull();
      expect(JSON.parse(cached!)).toEqual({});
    });

    it('should not cache when no owner config transaction is found', async () => {
      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
      ];

      await service.analyze({ chainId, transactions });

      expect(fakeCacheService.keyCount()).toBe(0);
    });

    it('should proceed with analysis when cached value is invalid JSON', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());
      const ownerConfigs = [addOwnerDecoded(newEoa, 1)];

      const cacheDir = CacheRouter.getDeadlockAnalysisCacheDir({
        chainId,
        safeAddress,
        dataDecoded: ownerConfigs,
      });
      await fakeCacheService.hSet(cacheDir, 'invalid-json', 600);

      const transactions = [
        buildDecodedTx({ to: safeAddress, dataDecoded: ownerConfigs[0] }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({ address: safeAddress, owners: [eoa1], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({});
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
          dataDecoded: addOwnerDecoded(safeBAddress, 2),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      await service.analyze({ chainId, transactions });

      // getSafe called once for target Safe, then once each for safeB + safeC in parallel
      // Plus once each for eoa1 (rejected) in the batch
      const safeOwnerCalls = callOrder.filter(
        (c) => c !== `getSafe:${safeAddress.toLowerCase()}`,
      );
      expect(safeOwnerCalls.length).toBeGreaterThanOrEqual(2);
      expect(safeOwnerCalls).toContain(`getSafe:${safeBAddress.toLowerCase()}`);
      expect(safeOwnerCalls).toContain(`getSafe:${safeCAddress.toLowerCase()}`);
    });

    it('should batch all nested isSafe checks into a single Promise.allSettled', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const safeCAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const nestedOwner1 = getAddress(faker.finance.ethereumAddress());
      const nestedOwner2 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 2),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      // isSafe is only called for nested candidates now (depth 1)
      mockTransactionApi.isSafe.mockResolvedValue(false);

      await service.analyze({ chainId, transactions });

      // isSafe calls: only for nested candidates (nestedOwner1, nestedOwner2)
      // No depth-0 isSafe calls since getSafe handles that
      const isSafeCalls = mockTransactionApi.isSafe.mock.calls.map((c) =>
        c[0].toLowerCase(),
      );
      expect(isSafeCalls).toContain(nestedOwner1.toLowerCase());
      expect(isSafeCalls).toContain(nestedOwner2.toLowerCase());
    });
  });

  describe('multiSend (multiple owner configs)', () => {
    it('should apply multiple owner configs sequentially to detect deadlock', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());
      const eoa1 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
        }),
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: changeThresholdDecoded(2),
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
              owners: [safeAddress],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });

    it('should return no deadlock when multiple addOwner calls leave Safe healthy', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const eoa2 = getAddress(faker.finance.ethereumAddress());
      const eoa3 = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(eoa2, 1),
        }),
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(eoa3, 1),
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
    });

    it('should ignore non-owner-config txns mixed in the array', async () => {
      const safeBAddress = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerDecoded(safeBAddress, 1),
        }),
        buildDecodedTx({
          to: getAddress(faker.finance.ethereumAddress()),
          dataDecoded: {
            method: 'approve',
            parameters: [],
          } as BaseDataDecoded,
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address.toLowerCase() === safeAddress.toLowerCase()) {
          return Promise.resolve(
            mockSafe({
              address: safeAddress,
              owners: [],
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });
  });

  describe('multi-Safe analysis', () => {
    it('should return results keyed by both addresses for 2 different Safes', async () => {
      const safeA = getAddress(faker.finance.ethereumAddress());
      const safeB = getAddress(faker.finance.ethereumAddress());
      const eoaA = getAddress(faker.finance.ethereumAddress());
      const eoaB = getAddress(faker.finance.ethereumAddress());
      const newOwnerA = getAddress(faker.finance.ethereumAddress());
      const newOwnerB = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeA,
          dataDecoded: addOwnerDecoded(newOwnerA, 1),
        }),
        buildDecodedTx({
          to: safeB,
          dataDecoded: addOwnerDecoded(newOwnerB, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address === safeA) {
          return Promise.resolve(
            mockSafe({ address: safeA, owners: [eoaA], threshold: 1 }),
          );
        }
        if (address === safeB) {
          return Promise.resolve(
            mockSafe({ address: safeB, owners: [eoaB], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // Both Safes analyzed, no deadlock (all owners are EOAs)
      expect(result).toEqual({});
      expect(mockTransactionApi.getSafe).toHaveBeenCalledWith(safeA);
      expect(mockTransactionApi.getSafe).toHaveBeenCalledWith(safeB);
    });

    it('should return DEADLOCK_DETECTED for Safe A and clean for Safe B', async () => {
      const safeA = getAddress(faker.finance.ethereumAddress());
      const safeB = getAddress(faker.finance.ethereumAddress());
      const eoaA = getAddress(faker.finance.ethereumAddress());
      const newOwnerB = getAddress(faker.finance.ethereumAddress());

      // Safe A adds Safe B as owner with threshold=2 (creates mutual dependency)
      // Safe B adds a new EOA owner (no deadlock risk for Safe B)
      const transactions = [
        buildDecodedTx({
          to: safeA,
          dataDecoded: addOwnerDecoded(safeB, 2),
        }),
        buildDecodedTx({
          to: safeB,
          dataDecoded: addOwnerDecoded(newOwnerB, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address === safeA) {
          // Safe A currently has eoaA as owner, threshold=1
          return Promise.resolve(
            mockSafe({ address: safeA, owners: [eoaA], threshold: 1 }),
          );
        }
        if (address === safeB) {
          // Safe B has safeA as sole owner, threshold=1 → mutual deadlock
          return Promise.resolve(
            mockSafe({ address: safeB, owners: [safeA], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // Safe A: mutual dependency with Safe B → DEADLOCK_DETECTED
      expect(result[safeA]).toEqual({
        [DeadlockStatusGroup.DEADLOCK]: [
          expect.objectContaining({
            type: DeadlockStatus.DEADLOCK_DETECTED,
          }),
        ],
      });
      // Safe B: after adding newOwnerB, projected owners = [safeA, newOwnerB]
      // safeA is a Safe but newOwnerB is an EOA → no deadlock (enough independent owners)
      // However safeA has mutual dep → but Safe B has threshold=1 and 1 non-dependent owner (newOwnerB)
      // So ownerNonDependent(1) >= threshold(1) → no deadlock for Safe B
      expect(result[safeB]).toBeUndefined();
    });

    it('should return FAILED for Safe A when its analysis throws and success for Safe B', async () => {
      const safeA = getAddress(faker.finance.ethereumAddress());
      const safeB = getAddress(faker.finance.ethereumAddress());
      const eoaB = getAddress(faker.finance.ethereumAddress());
      const newOwnerB = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        buildDecodedTx({
          to: safeA,
          dataDecoded: addOwnerDecoded(
            getAddress(faker.finance.ethereumAddress()),
            1,
          ),
        }),
        buildDecodedTx({
          to: safeB,
          dataDecoded: addOwnerDecoded(newOwnerB, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address === safeA) {
          return Promise.reject(new Error('API timeout'));
        }
        if (address === safeB) {
          return Promise.resolve(
            mockSafe({ address: safeB, owners: [eoaB], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // Safe A failed → FAILED entry
      expect(result[safeA]).toEqual({
        [DeadlockStatusGroup.DEADLOCK]: [
          {
            type: CommonStatus.FAILED,
            severity: DEADLOCK_SEVERITY_MAPPING[CommonStatus.FAILED],
            title: DEADLOCK_TITLE_MAPPING[CommonStatus.FAILED],
            description: DEADLOCK_DESCRIPTION_MAPPING[CommonStatus.FAILED]({
              error: 'API timeout',
            }),
          },
        ],
      });
      // Safe B succeeded (no deadlock — all EOAs)
      expect(result[safeB]).toBeUndefined();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Deadlock analysis failed for Safe ${safeA}`),
      );
    });

    it('should apply multiple operations for same Safe sequentially', async () => {
      const targetSafe = getAddress(faker.finance.ethereumAddress());
      const existingOwner = getAddress(faker.finance.ethereumAddress());
      const newOwner = getAddress(faker.finance.ethereumAddress());

      // addOwner then changeThreshold — both targeting the same Safe
      const transactions = [
        buildDecodedTx({
          to: targetSafe,
          dataDecoded: addOwnerDecoded(newOwner, 2),
        }),
        buildDecodedTx({
          to: targetSafe,
          dataDecoded: changeThresholdDecoded(1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address === targetSafe) {
          return Promise.resolve(
            mockSafe({
              address: targetSafe,
              owners: [existingOwner],
              threshold: 1,
            }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // Both ops applied sequentially: addOwner(newOwner, 2) → changeThreshold(1)
      // Projected state: owners=[existingOwner, newOwner], threshold=1
      // No deadlock (both are EOAs)
      expect(result).toEqual({});
    });

    it('should only include Safes with owner config operations in mixed batch', async () => {
      const safeA = getAddress(faker.finance.ethereumAddress());
      const otherAddr = getAddress(faker.finance.ethereumAddress());
      const eoaA = getAddress(faker.finance.ethereumAddress());
      const newOwner = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        // Non-owner-config: token transfer
        buildDecodedTx({
          to: otherAddr,
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
        // Owner config targeting Safe A
        buildDecodedTx({
          to: safeA,
          dataDecoded: addOwnerDecoded(newOwner, 1),
        }),
        // Another non-owner-config: approve
        buildDecodedTx({
          to: otherAddr,
          dataDecoded: {
            method: 'approve',
            parameters: [],
          } as BaseDataDecoded,
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address === safeA) {
          return Promise.resolve(
            mockSafe({ address: safeA, owners: [eoaA], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // Only Safe A appears — non-owner-config transactions are ignored
      expect(result).toEqual({});
      expect(mockTransactionApi.getSafe).toHaveBeenCalledWith(safeA);
      expect(mockTransactionApi.getSafe).not.toHaveBeenCalledWith(otherAddr);
    });

    it('should analyze other Safes even when requesting Safe has no owner configs', async () => {
      const otherSafe = getAddress(faker.finance.ethereumAddress());
      const eoaOther = getAddress(faker.finance.ethereumAddress());
      const newOwner = getAddress(faker.finance.ethereumAddress());

      // Only otherSafe has an owner config — safeAddress has none
      const transactions = [
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
        buildDecodedTx({
          to: otherSafe,
          dataDecoded: addOwnerDecoded(newOwner, 1),
        }),
      ];

      mockTransactionApi.getSafe.mockImplementation((address: Address) => {
        if (address === otherSafe) {
          return Promise.resolve(
            mockSafe({ address: otherSafe, owners: [eoaOther], threshold: 1 }),
          );
        }
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        transactions,
      });

      // otherSafe is still analyzed even though safeAddress has no owner configs
      expect(result).toEqual({});
      expect(mockTransactionApi.getSafe).toHaveBeenCalledWith(otherSafe);
    });

    it('should return empty when no owner config transactions exist for any Safe', async () => {
      const transactions = [
        buildDecodedTx({
          to: getAddress(faker.finance.ethereumAddress()),
          dataDecoded: {
            method: 'transfer',
            parameters: [],
          } as BaseDataDecoded,
        }),
        buildDecodedTx({
          to: getAddress(faker.finance.ethereumAddress()),
          dataDecoded: null,
        }),
      ];

      const result = await service.analyze({
        chainId,
        transactions,
      });

      expect(result).toEqual({});
      expect(mockTransactionApi.getSafe).not.toHaveBeenCalled();
    });
  });
});
