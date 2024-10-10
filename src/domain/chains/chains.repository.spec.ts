import { faker } from '@faker-js/faker/.';
import { chunk } from 'lodash';
import { getAddress } from 'viem';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Page } from '@/domain/entities/page.entity';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;
const mockConfigApi = {
  getChains: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>;
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
  let target: ChainsRepository;

  const maxLimit = 40;
  const maxSequentialPages = 3;

  beforeEach(() => {
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'safeConfig.chains.maxLimit') return maxLimit;
      if (key === 'safeConfig.chains.maxSequentialPages')
        return maxSequentialPages;
    });

    target = new ChainsRepository(
      mockLoggingService,
      mockConfigApi,
      mockTransactionApiManager,
      mockConfigurationService,
    );
  });

  it('should return all chains across pages below request limit', async () => {
    const offset = 40;
    const url = faker.internet.url({ appendSlash: true });
    const chains = Array.from(
      {
        length: maxLimit * (maxSequentialPages - 1), // One page less than request limit
      },
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
    );
    const pages = chunk(chains, maxLimit).map((results, i, arr) => {
      const pageOffset = (i + 1) * offset;

      const previous = ((): string | null => {
        if (i === 0) {
          return null;
        }
        return limitAndOffsetUrlFactory(maxLimit, pageOffset, url);
      })();
      const next = ((): string | null => {
        if (i === arr.length - 1) {
          return null;
        }
        return limitAndOffsetUrlFactory(maxLimit, pageOffset, url);
      })();

      return pageBuilder<Chain>()
        .with('results', results)
        .with('count', chains.length)
        .with('previous', previous)
        .with('next', next)
        .build();
    });
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Page<Chain>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === 40) {
          return Promise.resolve(pages[1]);
        }
        if (offset === 80) {
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
      limit: 40,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: 40,
      offset: 40,
    });
  });

  it('should return all chains across pages up request limit', async () => {
    const offset = 40;
    const url = faker.internet.url({ appendSlash: true });
    const chains = Array.from(
      {
        length: maxLimit * maxSequentialPages, // Exactly request limit
      },
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
    );
    const pages = chunk(chains, maxLimit).map((results, i, arr) => {
      const pageOffset = (i + 1) * offset;

      const previous = ((): string | null => {
        if (i === 0) {
          return null;
        }
        return limitAndOffsetUrlFactory(maxLimit, pageOffset, url);
      })();
      const next = ((): string | null => {
        if (i === arr.length - 1) {
          return null;
        }
        return limitAndOffsetUrlFactory(maxLimit, pageOffset, url);
      })();

      return pageBuilder<Chain>()
        .with('results', results)
        .with('count', chains.length)
        .with('previous', previous)
        .with('next', next)
        .build();
    });
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Page<Chain>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === 40) {
          return Promise.resolve(pages[1]);
        }
        if (offset === 80) {
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
      limit: 40,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: 40,
      offset: 40,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(3, {
      limit: 40,
      offset: 80,
    });
  });

  it('should return all chains across pages up to request limit and notify if there are more', async () => {
    const offset = 40;
    const url = faker.internet.url({ appendSlash: true });
    const chains = Array.from(
      {
        length: maxLimit * (maxSequentialPages + 1), // One page more than request limit
      },
      (_, i) => chainBuilder().with('chainId', i.toString()).build(),
    );
    const pages = chunk(chains, maxLimit).map((results, i, arr) => {
      const pageOffset = (i + 1) * offset;

      const previous = ((): string | null => {
        if (i === 0) {
          return null;
        }
        return limitAndOffsetUrlFactory(maxLimit, pageOffset, url);
      })();
      const next = ((): string | null => {
        if (i === arr.length - 1) {
          return null;
        }
        return limitAndOffsetUrlFactory(maxLimit, pageOffset, url);
      })();

      return pageBuilder<Chain>()
        .with('results', results)
        .with('count', chains.length)
        .with('previous', previous)
        .with('next', next)
        .build();
    });
    mockConfigApi.getChains.mockImplementation(
      ({ offset }): Promise<Page<Chain>> => {
        if (offset === 0) {
          return Promise.resolve(pages[0]);
        }
        if (offset === 40) {
          return Promise.resolve(pages[1]);
        }
        if (offset === 80) {
          return Promise.resolve(pages[2]);
        }
        return Promise.reject(new Error('Invalid offset'));
      },
    );

    const result = await target.getAllChains();

    expect(result).toStrictEqual(
      chains.slice(0, maxLimit * maxSequentialPages).map((chain) => {
        return {
          ...chain,
          ensRegistryAddress: getAddress(chain.ensRegistryAddress!),
        };
      }),
    );
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(1, {
      limit: 40,
      offset: 0,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(2, {
      limit: 40,
      offset: 40,
    });
    expect(mockConfigApi.getChains).toHaveBeenNthCalledWith(3, {
      limit: 40,
      offset: 80,
    });
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenNthCalledWith(
      1,
      'More chains available despite request limit reached',
    );
  });
});
