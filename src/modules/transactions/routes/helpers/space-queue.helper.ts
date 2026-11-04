// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import type { ChainSafeAddress } from '#/modules/safe/domain/entities/chain-safe-address.entity';
import { ConflictType } from '#/modules/transactions/routes/entities/conflict-type.entity';
import {
  type ExecutionInfo,
  ExecutionInfoType,
} from '#/modules/transactions/routes/entities/execution-info.entity';
import type { MultisigExecutionInfo } from '#/modules/transactions/routes/entities/multisig-execution-info.entity';
import {
  type QueuedItem,
  QueuedItemType,
} from '#/modules/transactions/routes/entities/queued-item.entity';
import {
  LabelItem,
  type LabelQueuedItem,
} from '#/modules/transactions/routes/entities/queued-items/label-queued-item.entity';
import type { TransactionQueuedItem } from '#/modules/transactions/routes/entities/queued-items/transaction-queued-item.entity';
import {
  SpaceQueueStatus,
  type SpaceQueueStatuses,
} from '#/modules/transactions/routes/entities/schemas/space-queue-filters.schema';
import type {
  SpaceQueueCounts,
  SpaceQueueItems,
  SpaceQueueSafe,
} from '#/modules/transactions/routes/entities/space-queued-item-page.entity';
import { TransactionStatus } from '#/modules/transactions/routes/entities/transaction-status.entity';

export const SPACE_QUEUE_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1_000;

export type SpaceQueueFilters = {
  statuses?: SpaceQueueStatuses;
  safes?: Array<ChainSafeAddress>;
  conflicting?: boolean;
  stale?: boolean;
};

type TransactionTraits = {
  status: SpaceQueueStatus;
  conflicting: boolean;
  stale: boolean;
};

const isSameAddress = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

const isLabel = (item: QueuedItem): item is LabelQueuedItem =>
  item.type === QueuedItemType.Label;

const isTransaction = (item: QueuedItem): item is TransactionQueuedItem =>
  item.type === QueuedItemType.Transaction;

const isMultisig = (
  executionInfo: ExecutionInfo | null,
): executionInfo is MultisigExecutionInfo =>
  executionInfo?.type === ExecutionInfoType.Multisig;

const getTraits = (args: {
  item: TransactionQueuedItem;
  isNext: boolean;
  signers: ReadonlyArray<string>;
  now: number;
}): TransactionTraits => {
  const { transaction, conflictType } = args.item;
  const conflicting = conflictType !== ConflictType.None;
  const stale = transaction.timestamp < args.now - SPACE_QUEUE_STALE_AFTER_MS;

  if (transaction.txStatus === TransactionStatus.AwaitingExecution) {
    const status = args.isNext
      ? SpaceQueueStatus.Execute
      : SpaceQueueStatus.Blocked;
    return { status, conflicting, stale };
  }

  const missingSigners = isMultisig(transaction.executionInfo)
    ? (transaction.executionInfo.missingSigners ?? [])
    : [];
  const canSign = missingSigners.some(({ value }) =>
    args.signers.some((signer) => isSameAddress(signer, value)),
  );
  const status = canSign ? SpaceQueueStatus.Sign : SpaceQueueStatus.Waiting;
  return { status, conflicting, stale };
};

/**
 * The items of one Safe on one chain, split where the queue reads them as a
 * unit: a label, a conflict header with the transactions sharing its nonce,
 * or a lone transaction. Each transaction carries its traits.
 */
const getGroups = (args: {
  items: Array<QueuedItem>;
  signers: ReadonlyArray<string>;
  now: number;
}): Array<{
  items: Array<QueuedItem>;
  traits: Array<TransactionTraits>;
  label?: LabelQueuedItem;
}> => {
  const groups: ReturnType<typeof getGroups> = [];
  let label: LabelQueuedItem | undefined;

  for (const item of args.items) {
    if (isLabel(item)) {
      label = item;
      groups.push({ items: [item], traits: [], label: item });
      continue;
    }
    const traits = isTransaction(item)
      ? [
          getTraits({
            item,
            isNext: label?.label === LabelItem.Next,
            signers: args.signers,
            now: args.now,
          }),
        ]
      : [];
    const previous = groups.at(-1);
    // A conflict group runs from its header to its End transaction
    const continuesConflict =
      previous !== undefined &&
      !previous.label &&
      previous.items[0].type === QueuedItemType.ConflictHeader &&
      !previous.items.some(
        (other) =>
          isTransaction(other) && other.conflictType === ConflictType.End,
      );
    if (continuesConflict && isTransaction(item)) {
      previous.items.push(item);
      previous.traits.push(...traits);
    } else {
      groups.push({ items: [item], traits });
    }
  }
  return groups;
};

export const getSpaceQueueCounts = (args: {
  results: SpaceQueueItems;
  signers: ReadonlyArray<string>;
  now: number;
}): SpaceQueueCounts => {
  const counts: SpaceQueueCounts = {
    total: 0,
    execute: 0,
    sign: 0,
    blocked: 0,
    waiting: 0,
    conflicting: 0,
    stale: 0,
  };
  for (const chains of Object.values(args.results)) {
    for (const items of Object.values(chains)) {
      for (const group of getGroups({
        items,
        signers: args.signers,
        now: args.now,
      })) {
        for (const traits of group.traits) {
          counts.total++;
          counts[traits.status]++;
          if (traits.conflicting) {
            counts.conflicting++;
          }
          if (traits.stale) {
            counts.stale++;
          }
        }
      }
    }
  }
  return counts;
};

const matches = (
  traits: TransactionTraits,
  filters: SpaceQueueFilters,
): boolean =>
  (!filters.statuses || filters.statuses.includes(traits.status)) &&
  (!filters.conflicting || traits.conflicting) &&
  (!filters.stale || traits.stale);

const isSelected = (
  safe: SpaceQueueSafe,
  selection: SpaceQueueFilters['safes'],
): boolean =>
  !selection ||
  selection.some(
    ({ chainId, safeAddress }) =>
      chainId === safe.chainId && isSameAddress(safeAddress, safe.safeAddress),
  );

/**
 * The queue narrowed to the selected Safes and to the transactions matching
 * the filters. A matching transaction keeps its whole conflict group and the
 * label it sits under, so the client still sees why it is blocked or in
 * conflict.
 */
export const filterSpaceQueue = (args: {
  results: SpaceQueueItems;
  unavailableSafes: Array<SpaceQueueSafe>;
  filters: SpaceQueueFilters;
  signers: ReadonlyArray<string>;
  now: number;
}): { results: SpaceQueueItems; unavailableSafes: Array<SpaceQueueSafe> } => {
  const results: SpaceQueueItems = {};

  for (const [safeAddress, chains] of Object.entries(args.results)) {
    for (const [chainId, items] of Object.entries(chains)) {
      if (
        !isSelected(
          { chainId, safeAddress: safeAddress as Address },
          args.filters.safes,
        )
      ) {
        continue;
      }
      const kept: Array<QueuedItem> = [];
      let pendingLabel: LabelQueuedItem | undefined;
      for (const group of getGroups({
        items,
        signers: args.signers,
        now: args.now,
      })) {
        if (group.label) {
          pendingLabel = group.label;
          continue;
        }
        if (!group.traits.some((traits) => matches(traits, args.filters))) {
          continue;
        }
        if (pendingLabel) {
          kept.push(pendingLabel);
          pendingLabel = undefined;
        }
        kept.push(...group.items);
      }
      if (kept.length > 0) {
        const address = safeAddress as Address;
        results[address] = { ...results[address], [chainId]: kept };
      }
    }
  }

  return {
    results,
    unavailableSafes: args.unavailableSafes.filter((safe) =>
      isSelected(safe, args.filters.safes),
    ),
  };
};
