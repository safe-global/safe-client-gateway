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
import { DeadlockStatus } from '../entities/deadlock-status.entity';
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
          .with('description', DEADLOCK_DESCRIPTION_MAPPING[status])
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
          dataDecoded: addOwnerBaseDataDecoded(newEoa, 1),
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
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      const result = await service.analyze({
        chainId,
        safeAddress,
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
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      mockTransactionApi.isSafe.mockResolvedValue(false);

      const result = await service.analyze({
        chainId,
        safeAddress,
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
          return Promise.reject(new DataSourceError('Not found', 404));
        });

        const result = await service.analyze({
          chainId,
          safeAddress,
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
          return Promise.reject(new DataSourceError('Not found', 404));
        });

        mockTransactionApi.isSafe.mockResolvedValue(false);

        const result = await service.analyze({
          chainId,
          safeAddress,
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
            dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 2),
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
          safeAddress,
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
          return Promise.reject(
            new DataSourceError('Service unavailable', 503),
          );
        });

        const result = await service.analyze({
          chainId,
          safeAddress,
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
          safeAddress,
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
            dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 2),
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
          safeAddress,
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
            dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
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
          safeAddress,
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
      const ownerConfigs = [addOwnerBaseDataDecoded(newOwner, 1)];
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
      const ownerConfigs = [addOwnerBaseDataDecoded(newEoa, 1)];

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

      await service.analyze({ chainId, safeAddress, transactions });

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

      await service.analyze({ chainId, safeAddress, transactions });

      expect(fakeCacheService.keyCount()).toBe(0);
    });

    it('should proceed with analysis when cached value is invalid JSON', async () => {
      const eoa1 = getAddress(faker.finance.ethereumAddress());
      const newEoa = getAddress(faker.finance.ethereumAddress());
      const ownerConfigs = [addOwnerBaseDataDecoded(newEoa, 1)];

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
        safeAddress,
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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      await service.analyze({ chainId, safeAddress, transactions });

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
        return Promise.reject(new DataSourceError('Not found', 404));
      });

      // isSafe is only called for nested candidates now (depth 1)
      mockTransactionApi.isSafe.mockResolvedValue(false);

      await service.analyze({ chainId, safeAddress, transactions });

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
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
        }),
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
        safeAddress,
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
          dataDecoded: addOwnerBaseDataDecoded(eoa2, 1),
        }),
        buildDecodedTx({
          to: safeAddress,
          dataDecoded: addOwnerBaseDataDecoded(eoa3, 1),
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
        safeAddress,
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
          dataDecoded: addOwnerBaseDataDecoded(safeBAddress, 1),
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
        safeAddress,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });

    it('should produce same result as single-config when only one owner config exists', async () => {
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
        safeAddress,
        transactions,
      });

      expect(result).toEqual(
        expectedResponse(safeAddress, DeadlockStatus.DEADLOCK_DETECTED),
      );
    });
  });
});
