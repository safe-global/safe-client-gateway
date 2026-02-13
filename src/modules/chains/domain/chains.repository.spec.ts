import { faker } from '@faker-js/faker/.';
import chunk from 'lodash/chunk';
import { getAddress } from 'viem';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import { ChainsRepository } from '@/modules/chains/domain/chains.repository';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { IEtherscanApi } from '@/domain/interfaces/etherscan-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { type Raw, rawify } from '@/validation/entities/raw.entity';

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockConfigApi = {
  getChains: jest.fn(),
  getChainsV2: jest.fn(),
  getChainV2: jest.fn(),
  clearChainV2: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>;
const mockEtherscanApi = {
  getGasPrice: jest.fn(),
} as jest.MockedObjectDeep<IEtherscanApi>;
const mockTransactionApiManager =
  {} as jest.MockedObjectDeep<ITransactionApiManager>;
const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

/**
 * Note: all other methods of the repository are tested in situ.
 * Whilst `getAllChains` is to some extent as well, the following
 * tests are required to cover all edge cases.
 */
describe('ChainsRepository', () => {
  // According to the limits of the Config Service
  // @see https://github.com/safe-global/safe-config-service/blob/main/src/chains/views.py#L14-L16
  const OFFSET = 40;
  const MAX_LIMIT = 40;

  let target: ChainsRepository;
  const maxSequentialPages = 3;

  beforeEach(() => {
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'safeConfig.chains.maxSequentialPages')
        return maxSequentialPages;
    });

    target = new ChainsRepository(
      mockLoggingService,
      mockConfigApi,
      mockEtherscanApi,
      mockTransactionApiManager,
      mockConfigurationService,
    );
  });

  it('should return all chains across pages below request limit', async () => {
    const url = faker.internet.url({ appendSlash: true });
    const chains = faker.helpers.multiple(
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
      {
        count: ChainsRepository.MAX_LIMIT * (maxSequentialPages - 1), // One page less than request limit
      },
    );
    const pages = chunk(chains, ChainsRepository.MAX_LIMIT).map(
      (results, i, arr) => {
        const pageOffset = (i + 1) * OFFSET;

        const previous = ((): string | null => {
          if (i === 0) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();
        const next = ((): string | null => {
          if (i === arr.length - 1) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();

        return rawify(
          pageBuilder<Chain>()
            .with('results', results)
            .with('count', chains.length)
            .with('previous', previous)
            .with('next', next)
            .build(),
        );
      },
    );
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Raw<Page<Chain>>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === OFFSET) {
          return Promise.resolve(pages[1]);
        }
        if (offset === OFFSET * 2) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains.map((chain) => {
        return {
          ...chain,
          ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
        };
      }),
    );
    expect(mockConfigApi.getChains).toHaveBeenCalledTimes(2);
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: MAX_LIMIT,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: MAX_LIMIT,
      offset: OFFSET,
    });
  });

  it('should return all chains across pages up request limit', async () => {
    const url = faker.internet.url({ appendSlash: true });
    const chains = faker.helpers.multiple(
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
      {
        count: ChainsRepository.MAX_LIMIT * maxSequentialPages, // Exactly request limit
      },
    );
    const pages = chunk(chains, ChainsRepository.MAX_LIMIT).map(
      (results, i, arr) => {
        const pageOffset = (i + 1) * OFFSET;

        const previous = ((): string | null => {
          if (i === 0) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();
        const next = ((): string | null => {
          if (i === arr.length - 1) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();

        return rawify(
          pageBuilder<Chain>()
            .with('results', results)
            .with('count', chains.length)
            .with('previous', previous)
            .with('next', next)
            .build(),
        );
      },
    );
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Raw<Page<Chain>>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === OFFSET) {
          return Promise.resolve(pages[1]);
        }
        if (offset === OFFSET * 2) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains.map((chain) => {
        return {
          ...chain,
          ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
        };
      }),
    );
    expect(mockConfigApi.getChains).toHaveBeenCalledTimes(3);
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: MAX_LIMIT,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: MAX_LIMIT,
      offset: OFFSET,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(3, {
      limit: MAX_LIMIT,
      offset: OFFSET * 2,
    });
  });

  it('should return all chains across pages up to request limit and notify if there are more', async () => {
    const url = faker.internet.url({ appendSlash: true });
    const chains = faker.helpers.multiple(
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
      {
        count: ChainsRepository.MAX_LIMIT * (maxSequentialPages + 1), // One page more than request limit
      },
    );
    const pages = chunk(chains, ChainsRepository.MAX_LIMIT).map(
      (results, i, arr) => {
        const pageOffset = (i + 1) * OFFSET;

        const previous = ((): string | null => {
          if (i === 0) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();
        const next = ((): string | null => {
          if (i === arr.length - 1) {
            return null;
          }
          return limitAndOffsetUrlFactory(
            ChainsRepository.MAX_LIMIT,
            pageOffset,
            url,
          );
        })();

        return rawify(
          pageBuilder<Chain>()
            .with('results', results)
            .with('count', chains.length)
            .with('previous', previous)
            .with('next', next)
            .build(),
        );
      },
    );
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Raw<Page<Chain>>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === OFFSET) {
          return Promise.resolve(pages[1]);
        }
        if (offset === OFFSET * 2) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains
        .slice(0, ChainsRepository.MAX_LIMIT * maxSequentialPages)
        .map((chain) => {
          return {
            ...chain,
            ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
          };
        }),
    );
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: MAX_LIMIT,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: MAX_LIMIT,
      offset: OFFSET,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(3, {
      limit: MAX_LIMIT,
      offset: OFFSET * 2,
    });
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenNthCalledWith(
      1,
      'More chains available despite request limit reached',
    );
  });

  describe('V2 API methods', () => {
    const serviceKey = 'WALLET_WEB';

    it('should return chains from v2 endpoint', async () => {
      const limit = faker.number.int({ max: 10 });
      const offset = faker.number.int({ max: 10 });
      const chains = [chainBuilder().build(), chainBuilder().build()];
      const page = rawify(
        pageBuilder<Chain>()
          .with('results', chains)
          .with('count', chains.length)
          .with('previous', null)
          .with('next', null)
          .build(),
      );
      mockConfigApi.getChainsV2.mockResolvedValueOnce(page);

      const result = await target.getChainsV2(serviceKey, limit, offset);

      expect(result.count).toBe(chains.length);
      expect(result.results).toHaveLength(chains.length);
      expect(result.results[0].chainId).toBe(chains[0].chainId);
      expect(result.results[1].chainId).toBe(chains[1].chainId);
      expect(result.results[0].ensRegistryAddress).toBe(
        chains[0].ensRegistryAddress
          ? getAddress(chains[0].ensRegistryAddress)
          : null,
      );
      expect(result.results[1].ensRegistryAddress).toBe(
        chains[1].ensRegistryAddress
          ? getAddress(chains[1].ensRegistryAddress)
          : null,
      );
      expect(result.next).toBeNull();
      expect(result.previous).toBeNull();
      expect(mockConfigApi.getChainsV2).toHaveBeenCalledTimes(1);
      expect(mockConfigApi.getChainsV2).toHaveBeenCalledWith(serviceKey, {
        limit,
        offset,
      });
    });

    it('should return single chain from v2 endpoint', async () => {
      const chainId = faker.string.numeric();
      const chain = chainBuilder().with('chainId', chainId).build();
      const rawChain = rawify(chain);
      mockConfigApi.getChainV2.mockResolvedValueOnce(rawChain);

      const result = await target.getChainV2(serviceKey, chainId);

      expect(result).toStrictEqual({
        ...chain,
        ensRegistryAddress: chain.ensRegistryAddress
          ? getAddress(chain.ensRegistryAddress)
          : null,
      });
      expect(mockConfigApi.getChainV2).toHaveBeenCalledTimes(1);
      expect(mockConfigApi.getChainV2).toHaveBeenCalledWith(
        serviceKey,
        chainId,
      );
    });

    it('should clear v2 cache for a chain', async () => {
      const chainId = faker.string.numeric();
      mockConfigApi.clearChainV2.mockResolvedValueOnce(undefined);

      await target.clearChainV2(chainId, serviceKey);

      expect(mockConfigApi.clearChainV2).toHaveBeenCalledTimes(1);
      expect(mockConfigApi.clearChainV2).toHaveBeenCalledWith(
        serviceKey,
        chainId,
      );
    });
  });
});
