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
import { PaginationData } from '#/routes/common/pagination/pagination.data';

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
  const routeUrl = new URL(faker.internet.url());

  beforeEach(() => {
    vi.resetAllMocks();
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.filterValueParsing', false);
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
    it('maps consecutive runs of one Safe in nonce order, each against its own Safe', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const [addressA, addressB] = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ].sort((x, y) => (x.toLowerCase() < y.toLowerCase() ? -1 : 1));
      const safeA = safeBuilder()
        .with('address', addressA)
        .with('nonce', 3)
        .build();
      const safeB = safeBuilder()
        .with('address', addressB)
        .with('nonce', 3)
        .build();
      mockSafeRepository.getSafe.mockImplementation(({ address }) =>
        Promise.resolve(address === addressA ? safeA : safeB),
      );
      const a3 = queuedTransaction(chainId, safeA, 3);
      const b3 = queuedTransaction(chainId, safeB, 3);
      const a3Replacement = queuedTransaction(chainId, safeA, 3);
      const a4 = queuedTransaction(chainId, safeA, 4);
      // The queue service breaks nonce ties by insertion, interleaving Safes
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage([a3, b3, a3Replacement, a4], 4),
      );

      const actual = await target.getTransactionQueueForSafes({
        safes: [
          { chainId, address: addressA },
          { chainId, address: addressB },
        ],
        routeUrl,
        paginationData: new PaginationData(20, 0),
      });

      expect(actual.next).toBeNull();
      expect(actual.count).toBe(4);
      expect(actual.unavailableSafes).toEqual([]);
      const expectedRuns = [
        { safe: safeA, transactions: [a3, a3Replacement], previous: null },
        { safe: safeB, transactions: [b3], previous: null },
        { safe: safeA, transactions: [a4], previous: 3 },
      ];
      expect(actual.results).toEqual(
        expectedRuns.map(({ safe }) => ({
          chainId,
          safeAddress: safe.address,
          items: [],
        })),
      );
      expectedRuns.forEach(({ safe, transactions, previous }, index) => {
        expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenNthCalledWith(
          index + 1,
          {
            count: transactions.length,
            next: null,
            previous: null,
            results: transactions.map(({ transaction }) => transaction),
          },
          safe,
          chainId,
          previous,
          null,
        );
      });
    });

    it('completes the last nonce of a page and points the next page past it', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().with('nonce', 1).build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      const limit = 2;
      const first = queuedTransaction(chainId, safe, 1);
      const second = queuedTransaction(chainId, safe, 2);
      const conflicting = queuedTransaction(chainId, safe, 2);
      const following = queuedTransaction(chainId, safe, 3);
      mockSafeRepository.getTransactionQueueForSafes
        .mockResolvedValueOnce(queuePage([first, second, conflicting], 5))
        .mockResolvedValueOnce(queuePage([conflicting, following], 3));

      const actual = await target.getTransactionQueueForSafes({
        safes: [{ chainId, address: safe.address }],
        routeUrl,
        paginationData: new PaginationData(limit, 0),
      });

      const safes = [{ chainId, safe }];
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenNthCalledWith(1, { safes, limit: limit + 1, offset: 0 });
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenNthCalledWith(2, {
        safes,
        limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
        offset: limit,
      });
      expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [first, second, conflicting].map(
            ({ transaction }) => transaction,
          ),
        }),
        safe,
        chainId,
        null,
        null,
      );
      const next = new URL(actual.next ?? '');
      expect(next.searchParams.get('cursor')).toBe(`limit=${limit}&offset=3`);
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
        safes: [
          { chainId, address: safe.address },
          { chainId, address: undeployed },
          { chainId, address: unreachable },
        ],
        routeUrl,
        paginationData: new PaginationData(20, 0),
      });

      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: undeployed },
        { chainId, safeAddress: unreachable },
      ]);
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ safes: [{ chainId, safe }] }),
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
        safes: [{ chainId, address }],
        routeUrl,
        paginationData: new PaginationData(20, 0),
      });

      expect(actual).toEqual({
        count: 0,
        next: null,
        previous: null,
        results: [],
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
        safes: [
          { chainId, address: safe.address },
          { chainId, address: undeployed },
        ],
        routeUrl,
        paginationData: new PaginationData(20, 0),
      });

      expect(actual).toEqual({
        count: 0,
        next: null,
        previous: null,
        results: [],
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

    it('reports the Safes as unavailable when completing the last nonce fails', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().with('nonce', 1).build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockSafeRepository.getTransactionQueueForSafes
        .mockResolvedValueOnce(
          queuePage(
            [
              queuedTransaction(chainId, safe, 1),
              queuedTransaction(chainId, safe, 1),
            ],
            2,
          ),
        )
        .mockRejectedValueOnce(
          new DataSourceError(
            faker.lorem.sentence(),
            HttpStatus.SERVICE_UNAVAILABLE,
          ),
        );

      const actual = await target.getTransactionQueueForSafes({
        safes: [{ chainId, address: safe.address }],
        routeUrl,
        paginationData: new PaginationData(1, 0),
      });

      expect(actual.results).toEqual([]);
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
        safes: [
          ...addresses.map((address) => ({ chainId, address })),
          { chainId, address: addresses[0] },
          { chainId: otherChainId, address: addresses[0] },
          { chainId: otherChainId, address: overflow },
        ],
        routeUrl,
        paginationData: new PaginationData(20, 0),
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
