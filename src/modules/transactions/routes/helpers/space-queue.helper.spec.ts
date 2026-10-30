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
  SPACE_QUEUE_STALE_AFTER_MS,
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
      const { items } = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: items } },
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
      });
    });

    it('adds the queues of every Safe and chain', () => {
      const first = buildQueue();
      const second = buildQueue();

      const counts = getSpaceQueueCounts({
        results: {
          [safeA]: { [chainId]: first.items },
          [safeB]: { [chainId]: second.items },
        },
        signers: [signer],
        now,
      });

      expect(counts.total).toBe(12);
      expect(counts.sign).toBe(4);
    });

    it('matches the caller wallets regardless of address case', () => {
      const { items } = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: items } },
        signers: [signer.toLowerCase()],
        now,
      });

      expect(counts.sign).toBe(2);
    });

    it('counts every unsigned transaction as waiting for a caller without wallets', () => {
      const { items } = buildQueue();

      const counts = getSpaceQueueCounts({
        results: { [safeA]: { [chainId]: items } },
        signers: [],
        now,
      });

      expect(counts).toMatchObject({ sign: 0, waiting: 4, total: 6 });
    });

    it('returns zero counts for an empty queue', () => {
      expect(
        getSpaceQueueCounts({ results: {}, signers: [signer], now }),
      ).toEqual({
        total: 0,
        execute: 0,
        blocked: 0,
        sign: 0,
        waiting: 0,
        conflicting: 0,
        stale: 0,
      });
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
  });
});
