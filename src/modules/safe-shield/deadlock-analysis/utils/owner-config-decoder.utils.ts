// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address } from 'viem';
import { getAddress, isAddressEqual } from 'viem';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';

export enum OwnerConfigMethod {
  AddOwnerWithThreshold = 'addOwnerWithThreshold',
  RemoveOwner = 'removeOwner',
  SwapOwner = 'swapOwner',
  ChangeThreshold = 'changeThreshold',
}

const OWNER_CONFIG_METHODS: Set<string> = new Set(
  Object.values(OwnerConfigMethod),
);

export function isOwnerConfigTransaction(
  dataDecoded: BaseDataDecoded | null,
): boolean {
  return dataDecoded !== null && OWNER_CONFIG_METHODS.has(dataDecoded.method);
}

/**
 * Groups owner configuration transactions by their target Safe address.
 *
 * Scans all transactions for owner config methods (addOwnerWithThreshold,
 * removeOwner, swapOwner, changeThreshold) and groups them by normalized
 * `tx.to` address. Preserves transaction order within each group, which
 * is important for sequential state projection via `computeProjectedState()`.
 *
 * @param transactions - The flattened list of decoded transactions (e.g., from a multi-send).
 * @returns Map of target Safe address to ordered list of owner config operations.
 *          Empty map if no owner config transactions are found.
 */
export function groupOwnerConfigsByTarget(
  transactions: Array<{ to: Address; dataDecoded: BaseDataDecoded | null }>,
): Map<Address, Array<BaseDataDecoded>> {
  const groups = new Map<Address, Array<BaseDataDecoded>>();

  for (const tx of transactions) {
    if (!isOwnerConfigTransaction(tx.dataDecoded)) continue;

    const normalizedAddress = getAddress(tx.to);
    const existing = groups.get(normalizedAddress);
    if (existing) {
      existing.push(tx.dataDecoded!);
    } else {
      groups.set(normalizedAddress, [tx.dataDecoded!]);
    }
  }

  return groups;
}
/**
 * Computes the projected state after applying an owner config transaction.
 *
 * @param {Object} args - The arguments object containing the current owners and threshold, and the data decoded.
 * @param {Array<Address>} args.currentOwners - The current owners of the Safe.
 * @param {number} args.currentThreshold - The current threshold of the Safe.
 * @param {BaseDataDecoded} args.dataDecoded - The data decoded of the owner config transaction.
 * @returns {Object} The projected state containing the owners and threshold.
 */
export function computeProjectedState(args: {
  currentOwners: Array<Address>;
  currentThreshold: number;
  dataDecoded: BaseDataDecoded;
}): { owners: Array<Address>; threshold: number } {
  const { currentOwners, currentThreshold, dataDecoded } = args;
  const params = dataDecoded.parameters;

  switch (dataDecoded.method as OwnerConfigMethod) {
    case OwnerConfigMethod.AddOwnerWithThreshold: {
      const owner = getParam(params, 'owner');
      const threshold = getParam(params, '_threshold');
      return {
        owners: [...currentOwners, getAddress(owner)],
        threshold: Number(threshold),
      };
    }
    case OwnerConfigMethod.RemoveOwner: {
      const ownerToRemove = getParam(params, 'owner');
      const threshold = getParam(params, '_threshold');
      return {
        owners: currentOwners.filter(
          (o) => !isAddressEqual(o, ownerToRemove as Address),
        ),
        threshold: Number(threshold),
      };
    }
    case OwnerConfigMethod.SwapOwner: {
      const oldOwner = getParam(params, 'oldOwner');
      const newOwner = getParam(params, 'newOwner');
      return {
        owners: currentOwners.map((o) =>
          isAddressEqual(o, oldOwner as Address) ? getAddress(newOwner) : o,
        ),
        threshold: currentThreshold,
      };
    }
    case OwnerConfigMethod.ChangeThreshold: {
      const threshold = getParam(params, '_threshold');
      return {
        owners: currentOwners,
        threshold: Number(threshold),
      };
    }
    default:
      throw new Error(`Unsupported function: ${dataDecoded.method}`);
  }
}

function getParam(params: BaseDataDecoded['parameters'], name: string): string {
  const param = params?.find((p) => p.name === name);
  if (!param) {
    throw new Error(`Parameter '${name}' not found`);
  }
  return param.value as string;
}
