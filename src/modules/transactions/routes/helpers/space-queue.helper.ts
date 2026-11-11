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
import type { AddressInfo } from '#/routes/common/entities/address-info.entity';

export const SPACE_QUEUE_STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1_000;

/** A free-text search over Safe, network, status and the signers still to sign. */
export type SpaceQueueSearch = {
  /** Trimmed and lowercased */
  query: string;
  /** Address book names, keyed by lowercased address */
  names: ReadonlyMap<string, ReadonlyArray<string>>;
  chainNames: ReadonlyMap<string, string>;
};

export type SpaceQueueFilters = {
  statuses?: SpaceQueueStatuses;
  safes?: Array<ChainSafeAddress>;
  chainIds?: Array<string>;
  /** Keep the transactions still awaiting one of these signers */
  signers?: Array<Address>;
  conflicting?: boolean;
  stale?: boolean;
  search?: SpaceQueueSearch;
};

type TransactionTraits = {
  status: SpaceQueueStatus;
  conflicting: boolean;
  stale: boolean;
  missingSigners: Array<AddressInfo>;
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
  const missingSigners = isMultisig(transaction.executionInfo)
    ? (transaction.executionInfo.missingSigners ?? [])
    : [];

  if (transaction.txStatus === TransactionStatus.AwaitingExecution) {
    const status = args.isNext
      ? SpaceQueueStatus.Execute
      : SpaceQueueStatus.Blocked;
    return { status, conflicting, stale, missingSigners };
  }

  const canSign = missingSigners.some(({ value }) =>
    args.signers.some((signer) => isSameAddress(signer, value)),
  );
  const status = canSign ? SpaceQueueStatus.Sign : SpaceQueueStatus.Waiting;
  return { status, conflicting, stale, missingSigners };
};

const includesQuery = (
  text: string | null | undefined,
  query: string,
): boolean => !!text && text.toLowerCase().includes(query);

const addressMatches = (address: string, search: SpaceQueueSearch): boolean =>
  includesQuery(address, search.query) ||
  (search.names.get(address.toLowerCase()) ?? []).some((name) =>
    includesQuery(name, search.query),
  );

/** Whether every transaction of this Safe on this chain matches, by Safe or network. */
const safeMatchesSearch = (
  safe: SpaceQueueSafe,
  search: SpaceQueueFilters['search'],
): boolean =>
  !search ||
  addressMatches(safe.safeAddress, search) ||
  includesQuery(search.chainNames.get(safe.chainId), search.query);

const transactionMatchesSearch = (
  traits: TransactionTraits,
  search: SpaceQueueSearch,
): boolean =>
  includesQuery(traits.status, search.query) ||
  traits.missingSigners.some(
    (signer) =>
      addressMatches(signer.value, search) ||
      includesQuery(signer.name, search.query),
  );

const inSearch = (
  traits: TransactionTraits,
  filters: SpaceQueueFilters,
  safeMatches: boolean,
): boolean =>
  !filters.search ||
  safeMatches ||
  transactionMatchesSearch(traits, filters.search);

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

type CountTallies = {
  counts: SpaceQueueCounts;
  chains: Map<string, number>;
  signers: Map<string, { address: Address; count: number }>;
};

/** Which filters, other than the search, a transaction passes. */
type FilterMatches = {
  status: boolean;
  safe: boolean;
  chain: boolean;
  signer: boolean;
};

// Faceted: each count applies every filter but its own, so a menu tells how
// many transactions picking one of its options would show.
const tallyTransaction = (args: {
  tallies: CountTallies;
  chainId: string;
  traits: TransactionTraits;
  passes: FilterMatches;
}): number => {
  const { tallies, chainId, traits, passes } = args;
  if (passes.status && passes.safe && passes.signer) {
    tallies.chains.set(chainId, (tallies.chains.get(chainId) ?? 0) + 1);
  }
  for (const { value } of traits.missingSigners) {
    const key = value.toLowerCase();
    const signer = tallies.signers.get(key) ?? {
      address: value as Address,
      count: 0,
    };
    if (passes.status && passes.safe && passes.chain) {
      signer.count++;
    }
    tallies.signers.set(key, signer);
  }
  if (passes.safe && passes.chain && passes.signer) {
    tallies.counts.total++;
    tallies.counts[traits.status]++;
    if (traits.conflicting) {
      tallies.counts.conflicting++;
    }
    if (traits.stale) {
      tallies.counts.stale++;
    }
  }
  // What this transaction adds to its Safe count
  return passes.status && passes.chain && passes.signer ? 1 : 0;
};

export const getSpaceQueueCounts = (args: {
  results: SpaceQueueItems;
  filters: SpaceQueueFilters;
  signers: ReadonlyArray<string>;
  now: number;
}): SpaceQueueCounts => {
  const tallies: CountTallies = {
    counts: {
      total: 0,
      execute: 0,
      sign: 0,
      blocked: 0,
      waiting: 0,
      conflicting: 0,
      stale: 0,
      safes: [],
      chains: [],
      signers: [],
    },
    chains: new Map(),
    signers: new Map(),
  };
  for (const [safeAddress, chains] of Object.entries(args.results)) {
    for (const [chainId, items] of Object.entries(chains)) {
      const safe = { chainId, safeAddress: safeAddress as Address };
      const safeMatches = safeMatchesSearch(safe, args.filters.search);
      const passesSafe = isSelected(safe, args.filters.safes);
      const passesChain = isChainIncluded(chainId, args.filters.chainIds);
      tallies.chains.set(chainId, tallies.chains.get(chainId) ?? 0);
      let count = 0;
      for (const group of getGroups({
        items,
        signers: args.signers,
        now: args.now,
      })) {
        // The search is not a facet: it narrows every count
        for (const traits of group.traits.filter((traits) =>
          inSearch(traits, args.filters, safeMatches),
        )) {
          count += tallyTransaction({
            tallies,
            chainId,
            traits,
            passes: {
              status: matches(traits, args.filters),
              safe: passesSafe,
              chain: passesChain,
              signer: awaitsSigner(traits, args.filters.signers),
            },
          });
        }
      }
      tallies.counts.safes.push({ ...safe, count });
    }
  }
  return {
    ...tallies.counts,
    chains: Array.from(tallies.chains, ([chainId, count]) => ({
      chainId,
      count,
    })),
    signers: Array.from(tallies.signers.values()),
  };
};

const matches = (
  traits: TransactionTraits,
  filters: SpaceQueueFilters,
): boolean =>
  (!filters.statuses || filters.statuses.includes(traits.status)) &&
  (!filters.conflicting || traits.conflicting) &&
  (!filters.stale || traits.stale);

const awaitsSigner = (
  traits: TransactionTraits,
  signers: SpaceQueueFilters['signers'],
): boolean =>
  !signers ||
  traits.missingSigners.some(({ value }) =>
    signers.some((signer) => isSameAddress(signer, value)),
  );

const isChainIncluded = (
  chainId: string,
  chainIds: SpaceQueueFilters['chainIds'],
): boolean => !chainIds || chainIds.includes(chainId);

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
 * The queue narrowed to the selected Safes and chains and to the transactions matching
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
      const safe = { chainId, safeAddress: safeAddress as Address };
      if (
        !(
          isSelected(safe, args.filters.safes) &&
          isChainIncluded(chainId, args.filters.chainIds)
        )
      ) {
        continue;
      }
      const safeMatches = safeMatchesSearch(safe, args.filters.search);
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
        if (
          !group.traits.some(
            (traits) =>
              matches(traits, args.filters) &&
              awaitsSigner(traits, args.filters.signers) &&
              inSearch(traits, args.filters, safeMatches),
          )
        ) {
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
    unavailableSafes: args.unavailableSafes.filter(
      (safe) =>
        isSelected(safe, args.filters.safes) &&
        isChainIncluded(safe.chainId, args.filters.chainIds),
    ),
  };
};
