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
    const spaceId = faker.number.int({ min: 1 });

    it("returns one section per Safe address, each Safe's chains mapped against its Safe there", async () => {
      const [chainA, chainB] = [
        faker.string.numeric({ length: 3 }),
        faker.string.numeric({ length: 4 }),
      ];
      const multichain = getAddress(faker.finance.ethereumAddress());
      const single = getAddress(faker.finance.ethereumAddress());
      const safeOnA = safeBuilder().with('address', multichain).build();
      const safeOnB = safeBuilder().with('address', multichain).build();
      const singleSafe = safeBuilder().with('address', single).build();
      const safesByKey: Record<string, Safe> = {
        [`${chainA}:${multichain}`]: safeOnA,
        [`${chainB}:${multichain}`]: safeOnB,
        [`${chainA}:${single}`]: singleSafe,
      };
      mockSafeRepository.getSafe.mockImplementation(({ chainId, address }) =>
        Promise.resolve(safesByKey[`${chainId}:${address}`]),
      );
      const a5 = queuedTransaction(chainA, safeOnA, 5);
      const b2 = queuedTransaction(chainB, safeOnB, 2);
      const a6 = queuedTransaction(chainA, safeOnA, 6);
      const s1 = queuedTransaction(chainA, singleSafe, 1);
      mockSafeRepository.getTransactionQueueForSafes.mockImplementation(
        ({ safes }) =>
          Promise.resolve(
            safes[0].safe.address === multichain
              ? queuePage([b2, a5, a6], 3)
              : queuePage([s1], 1),
          ),
      );
      const pageSize = 20;

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [
          { chainId: chainA, address: multichain },
          { chainId: chainA, address: single },
          { chainId: chainB, address: multichain },
        ],
        routeUrl,
        pageSize,
        limits: [],
      });

      expect(actual).toEqual({
        results: [
          {
            safeAddress: multichain,
            count: 3,
            next: null,
            chains: [
              { chainId: chainA, items: [] },
              { chainId: chainB, items: [] },
            ],
          },
          {
            safeAddress: single,
            count: 1,
            next: null,
            chains: [{ chainId: chainA, items: [] }],
          },
        ],
        unavailableSafes: [],
      });
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith({
        spaceId,
        safes: [
          { chainId: chainA, safe: safeOnA },
          { chainId: chainB, safe: safeOnB },
        ],
        limit: pageSize + 1,
        offset: 0,
      });
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith({
        spaceId,
        safes: [{ chainId: chainA, safe: singleSafe }],
        limit: pageSize + 1,
        offset: 0,
      });
      expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenCalledWith(
        {
          count: 2,
          next: null,
          previous: null,
          results: [a5.transaction, a6.transaction],
        },
        safeOnA,
        chainA,
        null,
        null,
      );
      expect(mockQueuedItemsMapper.getQueuedItems).toHaveBeenCalledWith(
        { count: 1, next: null, previous: null, results: [b2.transaction] },
        safeOnB,
        chainB,
        null,
        null,
      );
    });

    it("points a Safe with more transactions to the queue with its limit raised by a page, completing the page's last nonce", async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().with('nonce', 1).build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      const pageSize = 2;
      const first = queuedTransaction(chainId, safe, 1);
      const second = queuedTransaction(chainId, safe, 2);
      const conflicting = queuedTransaction(chainId, safe, 2);
      const following = queuedTransaction(chainId, safe, 3);
      mockSafeRepository.getTransactionQueueForSafes
        .mockResolvedValueOnce(queuePage([first, second, conflicting], 5))
        .mockResolvedValueOnce(queuePage([conflicting, following], 3));

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: safe.address }],
        routeUrl,
        pageSize,
        limits: [],
      });

      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenNthCalledWith(2, {
        spaceId,
        safes: [{ chainId, safe }],
        limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
        offset: pageSize,
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
      const next = new URL(actual.results[0].next ?? '');
      expect(next.pathname).toBe(routeUrl.pathname);
      expect(next.searchParams.get('limits')).toBe(
        `${safe.address}:${3 + pageSize}`,
      );
    });

    it("returns as many transactions as the limits ask for a listed Safe, keeping every other Safe's limit in its next", async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const listed = safeBuilder().build();
      const other = safeBuilder().build();
      mockSafeRepository.getSafe.mockResolvedValue(listed);
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage(
          [1, 2, 3].map((nonce) => queuedTransaction(chainId, listed, nonce)),
          10,
        ),
      );
      const limits = [
        { safeAddress: other.address, limit: 4 },
        { safeAddress: listed.address, limit: 3 },
      ];

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: listed.address }],
        routeUrl,
        pageSize: 2,
        limits,
      });

      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledWith(expect.objectContaining({ limit: 4, offset: 0 }));
      const next = new URL(actual.results[0].next ?? '');
      expect(next.searchParams.get('limits')).toBe(
        `${other.address}:4,${listed.address}:5`,
      );
    });

    it('has no next for a Safe that shows the most transactions one request can hold', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage(
          Array.from({ length: SAFE_QUEUE_SERVICE_MAX_LIMIT }, (_, nonce) =>
            queuedTransaction(chainId, safe, nonce),
          ),
          SAFE_QUEUE_SERVICE_MAX_LIMIT + 50,
        ),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: safe.address }],
        routeUrl,
        pageSize: 2,
        limits: [
          {
            safeAddress: safe.address,
            limit: SAFE_QUEUE_SERVICE_MAX_LIMIT - 1,
          },
        ],
      });

      expect(actual.results[0].next).toBeNull();
    });

    it('leaves out Safes without pending transactions', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const safe = safeBuilder().build();
      mockSafeRepository.getSafe.mockResolvedValue(safe);
      mockSafeRepository.getTransactionQueueForSafes.mockResolvedValue(
        queuePage([], 0),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [{ chainId, address: safe.address }],
        routeUrl,
        pageSize: 20,
        limits: [],
      });

      expect(actual).toEqual({ results: [], unavailableSafes: [] });
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
        routeUrl,
        pageSize: 20,
        limits: [],
      });

      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: undeployed },
        { chainId, safeAddress: unreachable },
      ]);
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({ chainId, address: unreachable }),
      );
    });

    it('reports only the Safe whose queue cannot be loaded as unavailable, and logs it', async () => {
      const chainId = faker.string.numeric({ length: 3 });
      const failing = safeBuilder().build();
      const working = safeBuilder().build();
      mockSafeRepository.getSafe.mockImplementation(({ address }) =>
        Promise.resolve(address === failing.address ? failing : working),
      );
      const error = new DataSourceError(
        faker.lorem.sentence(),
        HttpStatus.SERVICE_UNAVAILABLE,
      );
      mockSafeRepository.getTransactionQueueForSafes.mockImplementation(
        ({ safes }) =>
          safes[0].safe === failing
            ? Promise.reject(error)
            : Promise.resolve(
                queuePage([queuedTransaction(chainId, working, 1)], 1),
              ),
      );

      const actual = await target.getTransactionQueueForSafes({
        spaceId,
        safes: [
          { chainId, address: failing.address },
          { chainId, address: working.address },
        ],
        routeUrl,
        pageSize: 20,
        limits: [],
      });

      expect(actual.results.map(({ safeAddress }) => safeAddress)).toEqual([
        working.address,
      ]);
      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: failing.address },
      ]);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          address: failing.address,
          error: error.message,
        }),
      );
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
        routeUrl,
        pageSize: 20,
        limits: [],
      });

      expect(actual.unavailableSafes).toEqual([
        { chainId, safeAddress: overflow },
        { chainId: otherChainId, safeAddress: overflow },
      ]);
      expect(mockSafeRepository.getSafe).toHaveBeenCalledTimes(
        SAFE_QUEUE_SERVICE_MAX_SAFES + 1,
      );
      expect(
        mockSafeRepository.getTransactionQueueForSafes,
      ).toHaveBeenCalledTimes(SAFE_QUEUE_SERVICE_MAX_SAFES);
    });
  });
});
