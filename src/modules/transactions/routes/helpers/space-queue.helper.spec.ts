// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import { transferTransactionInfoBuilder } from '#/modules/transactions/routes/entities/__tests__/transfer-transaction-info.builder';
import { ConflictType } from '#/modules/transactions/routes/entities/conflict-type.entity';
import { MultisigExecutionInfo } from '#/modules/transactions/routes/entities/multisig-execution-info.entity';
import type { QueuedItem } from '#/modules/transactions/routes/entities/queued-item.entity';
import { ConflictHeaderQueuedItem } from '#/modules/transactions/routes/entities/queued-items/conflict-header-queued-item.entity';
import {
  LabelItem,
  LabelQueuedItem,
} from '#/modules/transactions/routes/entities/queued-items/label-queued-item.entity';
import { TransactionQueuedItem } from '#/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import { Transaction } from '#/modules/transactions/routes/entities/transaction.entity';
import { TransactionStatus } from '#/modules/transactions/routes/entities/transaction-status.entity';
import {
  filterSpaceQueue,
  getSpaceQueueCounts,
  limitSpaceQueue,
  SPACE_QUEUE_STALE_AFTER_MS,
  type SpaceQueueSearch,
  someFiltersSet,
} from '#/modules/transactions/routes/helpers/space-queue.helper';
import { AddressInfo } from '#/routes/common/entities/address-info.entity';

const now = faker.date.recent().getTime();
const signer = getAddress(faker.finance.ethereumAddress());

const queuedTransaction = (args: {
  status: TransactionStatus;
  nonce?: number;
  missingSigners?: Array<Address>;
  conflictType?: ConflictType;
  timestamp?: number;
}): TransactionQueuedItem =>
  new TransactionQueuedItem(
    new Transaction(
      faker.string.uuid(),
      args.timestamp ?? now - faker.number.int({ min: 0, max: 60_000 }),
      args.status,
      transferTransactionInfoBuilder().build(),
      new MultisigExecutionInfo(
        args.nonce ?? faker.number.int({ min: 0, max: 1_000 }),
        2,
        1,
        (args.missingSigners ?? []).map((value) => new AddressInfo(value)),
      ),
    ),
    args.conflictType ?? ConflictType.None,
  );

const otherSigner = (): Address => getAddress(faker.finance.ethereumAddress());

const missingSignersOf = (item: TransactionQueuedItem): Array<Address> =>
  (
    (item.transaction.executionInfo as MultisigExecutionInfo).missingSigners ??
    []
  ).map(({ value }) => value as Address);

/** next: one executable; queued: one blocked, one to sign, one waiting, and a conflict pair (sign + waiting). */
const buildQueue = () => {
  const execute = queuedTransaction({
    status: TransactionStatus.AwaitingExecution,
  });
  const blocked = queuedTransaction({
    status: TransactionStatus.AwaitingExecution,
  });
  const sign = queuedTransaction({
    status: TransactionStatus.AwaitingConfirmations,
    missingSigners: [otherSigner(), signer],
  });
  const waiting = queuedTransaction({
    status: TransactionStatus.AwaitingConfirmations,
    missingSigners: [otherSigner()],
    timestamp: now - SPACE_QUEUE_STALE_AFTER_MS - 1,
  });
  const conflictNonce = faker.number.int({ min: 1_001, max: 2_000 });
  const conflictSign = queuedTransaction({
    status: TransactionStatus.AwaitingConfirmations,
    nonce: conflictNonce,
    missingSigners: [signer],
    conflictType: ConflictType.HasNext,
  });
  const conflictWaiting = queuedTransaction({
    status: TransactionStatus.AwaitingConfirmations,
    nonce: conflictNonce,
    missingSigners: [otherSigner()],
    conflictType: ConflictType.End,
  });
  const header = new ConflictHeaderQueuedItem(conflictNonce);
  const next = new LabelQueuedItem(LabelItem.Next);
  const queued = new LabelQueuedItem(LabelItem.Queued);
  const items: Array<QueuedItem> = [
    next,
    execute,
    queued,
    blocked,
    sign,
    waiting,
    header,
    conflictSign,
    conflictWaiting,
  ];
  return {
    items,
    execute,
    blocked,
    sign,
    waiting,
    header,
    conflictSign,
    conflictWaiting,
    next,
    queued,
  };
};

describe('space-queue.helper', () => {
  const safeA = getAddress(faker.finance.ethereumAddress());
  const safeB = getAddress(faker.finance.ethereumAddress());
  const chainId = faker.string.numeric({ length: 3 });

  describe('getSpaceQueueCounts', () => {
    it('counts each transaction under one status, plus the overlapping conflicting and stale counts', () => {
      const queue = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: queue.items } },
        filters: {},
        signers: [signer],
        now,
      });

      expect(counts).toEqual({
        total: 6,
        execute: 1,
        blocked: 1,
        sign: 2,
        waiting: 2,
        conflicting: 2,
        stale: 1,
        safes: [{ chainId, safeAddress: safeA, count: 6 }],
        chains: [{ chainId, count: 6 }],
        signers: [
          { address: missingSignersOf(queue.sign)[0], count: 1 },
          { address: signer, count: 2 },
          { address: missingSignersOf(queue.waiting)[0], count: 1 },
          { address: missingSignersOf(queue.conflictWaiting)[0], count: 1 },
        ],
      });
    });

    it('adds the queues of every Safe and chain, and counts each one', () => {
      const first = buildQueue();
      const second = buildQueue();

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: { [chainId]: first.items },
          [safeB]: { [chainId]: second.items },
        },
        filters: {},
        signers: [signer],
        now,
      });

      expect(counts.total).toBe(12);
      expect(counts.sign).toBe(4);
      expect(counts.safes).toEqual([
        { chainId, safeAddress: safeA, count: 6 },
        { chainId, safeAddress: safeB, count: 6 },
      ]);
    });

    it('counts the statuses of the selected Safes only', () => {
      const first = buildQueue();
      const onlyWaiting = [
        new LabelQueuedItem(LabelItem.Queued),
        queuedTransaction({
          status: TransactionStatus.AwaitingConfirmations,
          missingSigners: [otherSigner()],
        }),
      ];

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: { [chainId]: first.items },
          [safeB]: { [chainId]: onlyWaiting },
        },
        filters: { safes: [{ chainId, safeAddress: safeB }] },
        signers: [signer],
        now,
      });

      expect(counts).toMatchObject({
        total: 1,
        execute: 0,
        sign: 0,
        blocked: 0,
        waiting: 1,
        conflicting: 0,
        stale: 0,
      });
    });

    it('counts each Safe under the status filters but regardless of the Safe filter', () => {
      const first = buildQueue();
      const second = buildQueue();

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: { [chainId]: first.items },
          [safeB]: { [chainId]: second.items },
        },
        filters: {
          statuses: ['sign'],
          conflicting: true,
          safes: [{ chainId, safeAddress: safeA }],
        },
        signers: [signer],
        now,
      });

      expect(counts.safes).toEqual([
        { chainId, safeAddress: safeA, count: 1 },
        { chainId, safeAddress: safeB, count: 1 },
      ]);
    });

    it('keeps the status counts while a status is filtered', () => {
      const { items } = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: items } },
        filters: { statuses: ['execute'], stale: true },
        signers: [signer],
        now,
      });

      expect(counts).toMatchObject({ total: 6, sign: 2, waiting: 2 });
      expect(counts.safes).toEqual([{ chainId, safeAddress: safeA, count: 0 }]);
    });

    it('matches the caller wallets regardless of address case', () => {
      const { items } = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: items } },
        filters: {},
        signers: [signer.toLowerCase()],
        now,
      });

      expect(counts.sign).toBe(2);
    });

    it('counts every unsigned transaction as waiting for a caller without wallets', () => {
      const { items } = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: items } },
        filters: {},
        signers: [],
        now,
      });

      expect(counts).toMatchObject({ sign: 0, waiting: 4, total: 6 });
    });

    it('returns zero counts for an empty queue', () => {
      expect(
        getSpaceQueueCounts({
          results: {},
          filters: {},
          signers: [signer],
          now,
        }),
      ).toEqual({
        total: 0,
        execute: 0,
        blocked: 0,
        sign: 0,
        waiting: 0,
        conflicting: 0,
        stale: 0,
        safes: [],
        chains: [],
        signers: [],
      });
    });

    it('counts each chain under every filter but the chain filter', () => {
      const first = buildQueue();
      const second = buildQueue();
      const otherChainId = faker.string.numeric({ length: 4 });

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: { [chainId]: first.items, [otherChainId]: second.items },
        },
        filters: { statuses: ['sign'], chainIds: [chainId] },
        signers: [signer],
        now,
      });

      expect(counts.chains).toHaveLength(2);
      expect(counts.chains).toEqual(
        expect.arrayContaining([
          { chainId, count: 2 },
          { chainId: otherChainId, count: 2 },
        ]),
      );
      expect(counts).toMatchObject({ total: 6, sign: 2 });
      expect(counts.safes).toHaveLength(2);
      expect(counts.safes).toEqual(
        expect.arrayContaining([
          { chainId, safeAddress: safeA, count: 2 },
          { chainId: otherChainId, safeAddress: safeA, count: 0 },
        ]),
      );
    });

    it('counts each signer under every filter but the signer filter', () => {
      const queue = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: queue.items } },
        filters: { statuses: ['sign'], signers: [signer] },
        signers: [signer],
        now,
      });

      expect(counts.signers).toEqual([
        { address: missingSignersOf(queue.sign)[0], count: 1 },
        { address: signer, count: 2 },
        { address: missingSignersOf(queue.waiting)[0], count: 0 },
        { address: missingSignersOf(queue.conflictWaiting)[0], count: 0 },
      ]);
      expect(counts).toMatchObject({ total: 2, sign: 2, waiting: 0 });
      expect(counts.safes).toEqual([{ chainId, safeAddress: safeA, count: 2 }]);
      expect(counts.chains).toEqual([{ chainId, count: 2 }]);
    });

    it('counts a signer once across address cases', () => {
      const pending = queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        missingSigners: [signer],
      });
      const lowerCased = queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        missingSigners: [signer.toLowerCase() as Address],
      });

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: [pending, lowerCased] } },
        filters: { signers: [signer.toLowerCase() as Address] },
        signers: [],
        now,
      });

      expect(counts.signers).toEqual([{ address: signer, count: 2 }]);
      expect(counts.total).toBe(2);
    });
  });

  describe('filterSpaceQueue', () => {
    const filter = (
      filters: Parameters<typeof filterSpaceQueue>[0]['filters'],
      results: Parameters<typeof filterSpaceQueue>[0]['results'],
      unavailableSafes: Parameters<
        typeof filterSpaceQueue
      >[0]['unavailableSafes'] = [],
    ) =>
      filterSpaceQueue({
        results,
        unavailableSafes,
        filters,
        signers: [signer],
        now,
      });

    it('returns the queue untouched without filters', () => {
      const { items } = buildQueue();
      const results = { [safeA]: { [chainId]: items } };

      expect(filter({}, results).results).toEqual(results);
    });

    it('keeps the transactions of a status under their label', () => {
      const queue = buildQueue();

      const { results } = filter(
        { statuses: ['execute'] },
        { [safeA]: { [chainId]: queue.items } },
      );

      expect(results).toEqual({
        [safeA]: { [chainId]: [queue.next, queue.execute] },
      });
    });

    it('keeps a whole conflict group when one of its transactions matches', () => {
      const queue = buildQueue();

      const { results } = filter(
        { statuses: ['sign'] },
        { [safeA]: { [chainId]: queue.items } },
      );

      expect(results).toEqual({
        [safeA]: {
          [chainId]: [
            queue.queued,
            queue.sign,
            queue.header,
            queue.conflictSign,
            queue.conflictWaiting,
          ],
        },
      });
    });

    it('combines statuses and flags', () => {
      const queue = buildQueue();

      const { results } = filter(
        { statuses: ['waiting'], stale: true },
        { [safeA]: { [chainId]: queue.items } },
      );

      expect(results).toEqual({
        [safeA]: { [chainId]: [queue.queued, queue.waiting] },
      });
    });

    it('keeps only the conflict groups when asked for conflicting transactions', () => {
      const queue = buildQueue();

      const { results } = filter(
        { conflicting: true },
        { [safeA]: { [chainId]: queue.items } },
      );

      expect(results).toEqual({
        [safeA]: {
          [chainId]: [
            queue.queued,
            queue.header,
            queue.conflictSign,
            queue.conflictWaiting,
          ],
        },
      });
    });

    it('leaves out the Safes and chains with nothing left', () => {
      const queue = buildQueue();
      const onlyWaiting = [
        new LabelQueuedItem(LabelItem.Queued),
        queuedTransaction({
          status: TransactionStatus.AwaitingConfirmations,
          missingSigners: [otherSigner()],
        }),
      ];

      const { results } = filter(
        { statuses: ['execute'] },
        {
          [safeA]: { [chainId]: queue.items },
          [safeB]: { [chainId]: onlyWaiting },
        },
      );

      expect(Object.keys(results)).toEqual([safeA]);
    });

    it('keeps only the selected Safes, matching their address in any case, and their unavailable Safes', () => {
      const queue = buildQueue();
      const otherChainId = faker.string.numeric({ length: 4 });
      const unavailableSafes = [
        { chainId: otherChainId, safeAddress: safeA },
        { chainId, safeAddress: safeB },
      ];

      const filtered = filter(
        {
          safes: [
            {
              chainId: otherChainId,
              safeAddress: safeA.toLowerCase() as Address,
            },
          ],
        },
        {
          [safeA]: { [chainId]: queue.items, [otherChainId]: queue.items },
          [safeB]: { [chainId]: queue.items },
        },
        unavailableSafes,
      );

      expect(filtered.results).toEqual({
        [safeA]: { [otherChainId]: queue.items },
      });
      expect(filtered.unavailableSafes).toEqual([unavailableSafes[0]]);
    });

    it('keeps only the selected chains, and their unavailable Safes', () => {
      const queue = buildQueue();
      const otherChainId = faker.string.numeric({ length: 4 });
      const unavailableSafes = [
        { chainId: otherChainId, safeAddress: safeB },
        { chainId, safeAddress: safeB },
      ];

      const filtered = filter(
        { chainIds: [otherChainId] },
        {
          [safeA]: { [chainId]: queue.items, [otherChainId]: queue.items },
          [safeB]: { [chainId]: queue.items },
        },
        unavailableSafes,
      );

      expect(filtered.results).toEqual({
        [safeA]: { [otherChainId]: queue.items },
      });
      expect(filtered.unavailableSafes).toEqual([unavailableSafes[0]]);
    });

    it('keeps the transactions still awaiting one of the signers, in any case, under their label', () => {
      const queue = buildQueue();
      const [waitingSigner] = missingSignersOf(queue.waiting);

      const { results, unavailableSafes } = filter(
        { signers: [waitingSigner.toLowerCase() as Address] },
        { [safeA]: { [chainId]: queue.items } },
        [{ chainId, safeAddress: safeB }],
      );

      expect(results).toEqual({
        [safeA]: { [chainId]: [queue.queued, queue.waiting] },
      });
      expect(unavailableSafes).toEqual([{ chainId, safeAddress: safeB }]);
    });

    it('leaves out the fully signed transactions when filtering by signer', () => {
      const queue = buildQueue();

      const { results } = filter(
        { signers: [signer] },
        { [safeA]: { [chainId]: queue.items } },
      );

      expect(results).toEqual({
        [safeA]: {
          [chainId]: [
            queue.queued,
            queue.sign,
            queue.header,
            queue.conflictSign,
            queue.conflictWaiting,
          ],
        },
      });
    });
  });

  describe('search', () => {
    const otherChainId = faker.string.numeric({ length: 4 });
    const search = (
      query: string,
      overrides: Partial<SpaceQueueSearch> = {},
    ): SpaceQueueSearch => ({
      query,
      names: new Map(),
      chainNames: new Map(),
      ...overrides,
    });
    const filter = (
      filters: Parameters<typeof filterSpaceQueue>[0]['filters'],
      results: Parameters<typeof filterSpaceQueue>[0]['results'],
    ) =>
      filterSpaceQueue({
        results,
        unavailableSafes: [],
        filters,
        signers: [signer],
        now,
      }).results;

    it('keeps every chain of a Safe whose address matches, in any case', () => {
      const queue = buildQueue();
      const results = {
        [safeA]: { [chainId]: queue.items, [otherChainId]: queue.items },
        [safeB]: { [chainId]: queue.items },
      };

      expect(
        filter({ search: search(safeA.slice(2, 12).toLowerCase()) }, results),
      ).toEqual({ [safeA]: results[safeA] });
    });

    it('keeps a Safe whose address book name matches', () => {
      const queue = buildQueue();
      const names = new Map([[safeB.toLowerCase(), ['Treasury vault']]]);

      expect(
        filter(
          { search: search('treasury', { names }) },
          {
            [safeA]: { [chainId]: queue.items },
            [safeB]: { [chainId]: queue.items },
          },
        ),
      ).toEqual({ [safeB]: { [chainId]: queue.items } });
    });

    it('keeps the chains whose network name matches', () => {
      const queue = buildQueue();
      const chainNames = new Map([
        [chainId, 'Ethereum'],
        [otherChainId, 'Polygon'],
      ]);

      expect(
        filter(
          { search: search('poly', { chainNames }) },
          { [safeA]: { [chainId]: queue.items, [otherChainId]: queue.items } },
        ),
      ).toEqual({ [safeA]: { [otherChainId]: queue.items } });
    });

    it('keeps the transactions whose status matches, under their label', () => {
      const queue = buildQueue();

      expect(
        filter(
          { search: search('block') },
          { [safeA]: { [chainId]: queue.items } },
        ),
      ).toEqual({ [safeA]: { [chainId]: [queue.queued, queue.blocked] } });
    });

    it('keeps the transactions still awaiting a matching signer, by address or name', () => {
      const named = getAddress(faker.finance.ethereumAddress());
      const listed = getAddress(faker.finance.ethereumAddress());
      const byAddress = queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        missingSigners: [named],
      });
      const byBookName = queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        missingSigners: [listed],
      });
      const items = [byAddress, byBookName];
      const names = new Map([[listed.toLowerCase(), ['Bob']]]);

      expect(
        filter(
          { search: search(named.slice(4, 14).toLowerCase(), { names }) },
          { [safeA]: { [chainId]: items } },
        ),
      ).toEqual({ [safeA]: { [chainId]: [byAddress] } });
      expect(
        filter(
          { search: search('bob', { names }) },
          { [safeA]: { [chainId]: items } },
        ),
      ).toEqual({ [safeA]: { [chainId]: [byBookName] } });
    });

    it('combines the search with the status filter', () => {
      const queue = buildQueue();
      const chainNames = new Map([[chainId, 'Polygon']]);

      expect(
        filter(
          {
            search: search('polygon', { chainNames }),
            statuses: ['execute'],
          },
          { [safeA]: { [chainId]: queue.items } },
        ),
      ).toEqual({ [safeA]: { [chainId]: [queue.next, queue.execute] } });
    });

    it('leaves out everything when nothing matches', () => {
      const queue = buildQueue();

      expect(
        filter(
          { search: search('no such thing') },
          { [safeA]: { [chainId]: queue.items } },
        ),
      ).toEqual({});
    });

    it('counts only the transactions matching the search', () => {
      const queue = buildQueue();

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: { [chainId]: queue.items },
          [safeB]: { [chainId]: queue.items },
        },
        filters: { search: search('sign') },
        signers: [signer],
        now,
      });

      expect(counts).toEqual(
        expect.objectContaining({
          total: 4,
          sign: 4,
          execute: 0,
          waiting: 0,
          blocked: 0,
          safes: [
            { chainId, safeAddress: safeA, count: 2 },
            { chainId, safeAddress: safeB, count: 2 },
          ],
        }),
      );
    });

    it('keeps listing the signers and chains the search leaves out, with a count of 0', () => {
      const alice = getAddress(faker.finance.ethereumAddress());
      const bob = getAddress(faker.finance.ethereumAddress());
      const awaitingAlice = queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        missingSigners: [alice],
      });
      const awaitingBob = queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        missingSigners: [bob],
      });
      const names = new Map([
        [alice.toLowerCase(), ['Alice']],
        [bob.toLowerCase(), ['Bob']],
      ]);

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: {
            [chainId]: [awaitingAlice],
            [otherChainId]: [awaitingBob],
          },
        },
        filters: { search: search('alice', { names }) },
        signers: [],
        now,
      });

      expect(counts).toMatchObject({ total: 1, waiting: 1 });
      expect(counts.signers).toHaveLength(2);
      expect(counts.signers).toEqual(
        expect.arrayContaining([
          { address: alice, count: 1 },
          { address: bob, count: 0 },
        ]),
      );
      expect(counts.chains).toHaveLength(2);
      expect(counts.chains).toEqual(
        expect.arrayContaining([
          { chainId, count: 1 },
          { chainId: otherChainId, count: 0 },
        ]),
      );
      expect(counts.safes).toHaveLength(2);
      expect(counts.safes).toEqual(
        expect.arrayContaining([
          { chainId, safeAddress: safeA, count: 1 },
          { chainId: otherChainId, safeAddress: safeA, count: 0 },
        ]),
      );
    });
  });

  describe('someFiltersSet', () => {
    it('is false when every filter is unset', () => {
      expect(someFiltersSet({})).toBe(false);
      expect(someFiltersSet({ statuses: undefined, search: undefined })).toBe(
        false,
      );
    });

    it('is true when one filter is set, even to false', () => {
      expect(someFiltersSet({ stale: false })).toBe(true);
      expect(someFiltersSet({ search: faker.word.noun() })).toBe(true);
    });
  });

  describe('limitSpaceQueue', () => {
    const awaiting = (nonce: number, conflictType?: ConflictType) =>
      queuedTransaction({
        status: TransactionStatus.AwaitingConfirmations,
        nonce,
        conflictType,
      });

    it('keeps the first transactions by nonce across Safes, with their labels', () => {
      const nonce = faker.number.int({ min: 0, max: 100 });
      const next = new LabelQueuedItem(LabelItem.Next);
      const queued = new LabelQueuedItem(LabelItem.Queued);
      const first = awaiting(nonce);
      const third = awaiting(nonce + 2);
      const second = awaiting(nonce + 1);

      const actual = limitSpaceQueue({
        results: {
          [safeA]: { [chainId]: [next, first, queued, third] },
          [safeB]: { [chainId]: [next, second] },
        },
        limit: 2,
      });

      expect(actual).toEqual({
        [safeA]: { [chainId]: [next, first] },
        [safeB]: { [chainId]: [next, second] },
      });
    });

    it('keeps a conflict group whole, past the limit', () => {
      const nonce = faker.number.int({ min: 0, max: 100 });
      const next = new LabelQueuedItem(LabelItem.Next);
      const queued = new LabelQueuedItem(LabelItem.Queued);
      const lone = awaiting(nonce);
      const header = new ConflictHeaderQueuedItem(nonce + 1);
      const conflictFirst = awaiting(nonce + 1, ConflictType.HasNext);
      const conflictEnd = awaiting(nonce + 1, ConflictType.End);
      const items = [
        next,
        lone,
        queued,
        header,
        conflictFirst,
        conflictEnd,
        awaiting(nonce + 2),
      ];

      const actual = limitSpaceQueue({
        results: { [safeA]: { [chainId]: items } },
        limit: 2,
      });

      expect(actual).toEqual({
        [safeA]: {
          [chainId]: [next, lone, queued, header, conflictFirst, conflictEnd],
        },
      });
    });

    it('returns a queue shorter than the limit as it is', () => {
      const nonce = faker.number.int({ min: 0, max: 100 });
      const items = [
        new LabelQueuedItem(LabelItem.Next),
        awaiting(nonce),
        new LabelQueuedItem(LabelItem.Queued),
        awaiting(nonce + 1),
      ];

      const actual = limitSpaceQueue({
        results: { [safeA]: { [chainId]: items } },
        limit: faker.number.int({ min: 2, max: 100 }),
      });

      expect(actual).toEqual({ [safeA]: { [chainId]: items } });
    });
  });
});
