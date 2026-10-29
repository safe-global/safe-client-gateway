// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import {
  SAFE_QUEUE_SERVICE_MAX_LIMIT,
  SAFE_QUEUE_SERVICE_MAX_SAFES,
} from '#/domain/common/constants';
import { DataSourceError } from '#/domain/errors/data-source.error';
import type { ILoggingService } from '#/logging/logging.interface';
import type { IDataDecoderRepository } from '#/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import type { SafeRepository } from '#/modules/safe/domain/safe.repository';
import type { ITokenRepository } from '#/modules/tokens/domain/token.repository.interface';
import { ConflictHeaderQueuedItem } from '#/modules/transactions/routes/entities/queued-items/conflict-header-queued-item.entity';
import type { ModuleTransactionMapper } from '#/modules/transactions/routes/mappers/module-transactions/module-transaction.mapper';
import type { ModuleTransactionDetailsMapper } from '#/modules/transactions/routes/mappers/module-transactions/module-transaction-details.mapper';
import type { MultisigTransactionMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import type { MultisigTransactionDetailsMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-details.mapper';
import type { MultisigTransactionNoteMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import type { QueuedItemsMapper } from '#/modules/transactions/routes/mappers/queued-items/queued-items.mapper';
import type { TransactionPreviewMapper } from '#/modules/transactions/routes/mappers/transaction-preview.mapper';
import type { TransactionsHistoryMapper } from '#/modules/transactions/routes/mappers/transactions-history.mapper';
import type { TransferMapper } from '#/modules/transactions/routes/mappers/transfers/transfer.mapper';
import type { TransferDetailsMapper } from '#/modules/transactions/routes/mappers/transfers/transfer-details.mapper';
import { TransactionsService } from '#/modules/transactions/routes/transactions.service';

const mockSafeRepository = {
  getSafe: vi.fn(),
  getTransactionQueueForSafes: vi.fn(),
} as unknown as MockedObject<SafeRepository>;

const mockQueuedItemsMapper = {
  getQueuedItems: vi.fn(),
} as unknown as MockedObject<QueuedItemsMapper>;

const mockLoggingService = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('TransactionsService', () => {
  let target: TransactionsService;
  // At least three pages, so a test can read fewer pages than the maximum.
  const maxPages = faker.number.int({ min: 3, max: 5 });

  beforeEach(() => {
    vi.resetAllMocks();
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.filterValueParsing', false);
    configurationService.set('spaces.transactionQueue.maxPages', maxPages);
    target = new TransactionsService(
      mockSafeRepository,
      {} as IDataDecoderRepository,
      {} as MultisigTransactionMapper,
      {} as TransferMapper,
      {} as ModuleTransactionMapper,
      mockQueuedItemsMapper,
      {} as TransactionsHistoryMapper,
      {} as TransactionPreviewMapper,
      {} as ModuleTransactionDetailsMapper,
      {} as MultisigTransactionDetailsMapper,
      {} as MultisigTransactionNoteMapper,
      {} as TransferDetailsMapper,
      mockLoggingService,
      {} as ITokenRepository,
      configurationService,
    );
    mockQueuedItemsMapper.getQueuedItems.mockResolvedValue([]);
  });

  function queuedTransaction(
    chainId: string,
    safe: Safe,
    nonce: number,
  ): { chainId: string; transaction: MultisigTransaction } {
    return {
      chainId,
      transaction: multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', nonce)
        .build(),
    };
  }

  function queuePage(
    results: Array<{ chainId: string; transaction: MultisigTransaction }>,
    count: number,
  ): {
    count: number;
    next: string | null;
    previous: null;
    results: Array<{ chainId: string; transaction: MultisigTransaction }>;
  } {
    return {
      count,
      next: count > results.length ? faker.internet.url() : null,
      previous: null,
      results,
    };
  }

  describe('getTransactionQueueForSafes', () => {
    const spaceId = faker.number.int({ min: 1 });

    it('groups the queue by Safe address and chain, mapping each Safe once in nonce order', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const otherChainId = faker.string.numeric({ length: 4 });
      const safeA = safeBuilder().with('nonce', 3).build();
      const safeB = safeBuilder().with('nonce', 3).build();
      mockSafeRepository.getSafe.mockImplementation(({ address }) =>
        Promise.resolve(address === safeA.address ? safeA : safeB),
      );
      const a3 = queuedTransaction(chainId, safeA, 3);
      const b3 = queuedTransaction(chainId, safeB, 3);
      const a3Replacement = queuedTransaction(chainId, safeA, 3);
      const aOther3 = queuedTransaction(otherChainId, safeA, 3);
      const a4 = queuedTransaction(chainId, safeA, 4);
      // The queue service breaks nonce ties by insertion, interleaving Safes
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage([a3, b3, a3Replacement, aOther3, a4], 5),
      );
      const expectedGroups = [
        { chainId, safe: safeA, transactions: [a3, a3Replacement, a4] },
        { chainId, safe: safeB, transactions: [b3] },
        { chainId: otherChainId, safe: safeA, transactions: [aOther3] },
      ].map((group) => ({
        ...group,
        items: [new ConflictHeaderQueuedItem(faker.number.int())],
      }));
      mockQueuedItemsMapper.getQueuedItems.mockImplementation(
        (_, safe, groupChainId) =>
          Promise.resolve(
            expectedGroups.find(
              (group) => group.safe === safe && group.chainId === groupChainId,
            )?.items ?? [],
          ),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [
          { chainId, address: safeA.address },
          { chainId, address: safeB.address },
          { chainId: otherChainId, address: safeA.address },
        ],
      });

      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledExactlyOnceWith({
        spaceId,
        safes: [
          { chainId, safe: safeA },
          { chainId, safe: safeB },
          { chainId: otherChainId, safe: safeA },
        ],
        limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
        offset: 0,
      });
      expect(actual.next).toBeNull();
      expect(actual.count).toBe(5);
      expect(actual.unavailableSafes).toEqual([]);
      expect(actual.results).toEqual({
        [safeA.address]: {
          [chainId]: expectedGroups[0].items,
          [otherChainId]: expectedGroups[2].items,
        },
        [safeB.address]: { [chainId]: expectedGroups[1].items },
      });
      expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenCalledTimes(
        expectedGroups.length,
      );
      for (const group of expectedGroups) {
        expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenCalledWith(
          {
            count: group.transactions.length,
            next: null,
            previous: null,
            results: group.transactions.map(({ transaction }) => transaction),
          },
          group.safe,
          group.chainId,
          null,
          null,
        );
      }
    });

    it('reads every page of the queue and maps them as one queue', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().with('nonce', 0).build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      const pageCount = maxPages - 1;
      const count = faker.number.int({
        min: (pageCount - 1) * SAFE_QUEUE_SERVICE_MAX_LIMIT + 1,
        max: pageCount * SAFE_QUEUE_SERVICE_MAX_LIMIT,
      });
      // One transaction stands in for the results of each page
      const pages = Array.from({ length: pageCount }, (_, page) => [
        queuedTransaction(chainId, safe, page),
      ]);
      mockSafeRepository.getTransactionQueueForSafes.mockImplementation(
        ({ offset = 0 }) =>
          Promise.resolve(
            queuePage(pages[offset / SAFE_QUEUE_SERVICE_MAX_LIMIT], count),
          ),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: safe.address }],
      });

      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledTimes(pageCount);
      for (let page = 0; page < pageCount; page++) {
        expect(
          mockSafeRepository.getTransactionQueueForSafes,
        ).toHaveBeenCalledWith({
          spaceId,
          safes: [{ chainId, safe }],
          limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
          offset: page * SAFE_QUEUE_SERVICE_MAX_LIMIT,
        });
      }
      expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenCalledWith(
        {
          count: pageCount,
          next: null,
          previous: null,
          results: pages.flat().map(({ transaction }) => transaction),
        },
        safe,
        chainId,
        null,
        null,
      );
      expect(actual.count).toBe(count);
      expect(actual.next).toBeNull();
    });

    it('reads no more than the maximum number of pages', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      const count = faker.number.int({
        min: maxPages * SAFE_QUEUE_SERVICE_MAX_LIMIT + 1,
        max: maxPages * SAFE_QUEUE_SERVICE_MAX_LIMIT * 2,
      });
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage([], count),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: safe.address }],
      });

      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledTimes(maxPages);
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenLastCalledWith(
        expect.objectContaining({
          offset: (maxPages - 1) * SAFE_QUEUE_SERVICE_MAX_LIMIT,
        }),
      );
      expect(actual.count).toBe(count);
      expect(actual.next).toBeNull();
    });

    it('reports Safes that cannot be loaded as unavailable and leaves them out of the queue', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().build();
      const undeployed = getAddress(faker.finance.ethereumAddress());
      const unreachable = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockImplementation(({ address }) => {
        if (address === undeployed) {
          return Promise.reject(
            new DataSourceError(faker.lorem.sentence(), HttpStatus.NOT_FOUND),
          );
        }
        if (address === unreachable) {
          return Promise.reject(
            new DataSourceError(
              faker.lorem.sentence(),
              HttpStatus.SERVICE_UNAVAILABLE,
            ),
          );
        }
        return Promise.resolve(safe);
      });
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage([], 0),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [
          { chainId, address: safe.address },
          { chainId, address: undeployed },
          { chainId, address: unreachable },
        ],
      });

      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: undeployed },
        { chainId, safeAddress: unreachable },
      ]);
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ spaceId, safes: [{ chainId, safe }] }),
      );
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({ chainId, address: unreachable }),
      );
    });

    it('returns an empty page without calling the queue when no Safe can be loaded', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockRejectedValue(
        new DataSourceError(faker.lorem.sentence(), HttpStatus.NOT_FOUND),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address }],
      });

      expect(actual).toEqual({
        count: 0,
        next: null,
        previous: null,
        results: {},
        unavailableSafes: [{ chainId, safeAddress: address }],
      });
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).not.toHaveBeenCalled();
    });

    it('reports every loaded Safe as unavailable and logs when the queue cannot be loaded', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().build();
      const undeployed = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockImplementation(({ address }) =>
        address === undeployed
          ? Promise.reject(
              new DataSourceError(faker.lorem.sentence(), HttpStatus.NOT_FOUND),
            )
          : Promise.resolve(safe),
      );
      const error = new DataSourceError(
        faker.lorem.sentence(),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      mockSafeRepository.getTransactionQueueForSafes.mockRejectedValue(error);

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [
          { chainId, address: safe.address },
          { chainId, address: undeployed },
        ],
      });

      expect(actual).toEqual({
        count: 0,
        next: null,
        previous: null,
        results: {},
        unavailableSafes: [
          { chainId, safeAddress: undeployed },
          { chainId, safeAddress: safe.address },
        ],
      });
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: error.message }),
      );
    });

    it('reports the Safes as unavailable when a later page of the queue fails', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().with('nonce', 1).build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockSafeRepository.getTransactionQueueForSafes
        .mockResolvedValueOnce(
          queuePage(
            [queuedTransaction(chainId, safe, 1)],
            SAFE_QUEUE_SERVICE_MAX_LIMIT + 1,
          ),
        )
        .mockRejectedValueOnce(
          new DataSourceError(
            faker.lorem.sentence(),
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: safe.address }],
      });

      expect(actual.results).toEqual({});
      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: safe.address },
      ]);
      expect(mockQueuedItemsMapper.getQueuedItems).not.toHaveBeenCalled();
    });

    it('requests each Safe once and reports addresses beyond the queue service maximum as unavailable', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const otherChainId = faker.string.numeric({ length: 4 });
      const addresses: Array<Address> = Array.from(
        { length: SAFE_QUEUE_SERVICE_MAX_SAFES + 1 },
        () => getAddress(faker.finance.ethereumAddress()),
      );
      const overflow = addresses[SAFE_QUEUE_SERVICE_MAX_SAFES];
      mockSafeRepository.getSafe.mockImplementation(({ address }) =>
        Promise.resolve(safeBuilder().with('address', address).build()),
      );
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage([], 0),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [
          ...addresses.map((address) => ({ chainId, address })),
          { chainId, address: addresses[0] },
          { chainId: otherChainId, address: addresses[0] },
          { chainId: otherChainId, address: overflow },
        ],
      });

      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: overflow },
        { chainId: otherChainId, safeAddress: overflow },
      ]);
      expect(mockSafeRepository.getSafe).toHaveBeenCalledTimes(
        SAFE_QUEUE_SERVICE_MAX_SAFES + 1,
      );
    });
  });
});
