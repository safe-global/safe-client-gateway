// SPDX-License-Identifier: FSL-1.1-MIT
import { getAddress, type Address } from 'viem';
import { faker } from '@faker-js/faker';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import {
  isOwnerConfigTransaction,
  computeProjectedState,
  groupOwnerConfigsByTarget,
} from '../owner-config-decoder.utils';

function addr(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

function addOwnerDecoded(owner: Address, threshold: number): BaseDataDecoded {
  return {
    method: 'addOwnerWithThreshold',
    parameters: [
      { name: 'owner', type: 'address', value: owner },
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

function removeOwnerDecoded(
  owner: Address,
  threshold: number,
): BaseDataDecoded {
  return {
    method: 'removeOwner',
    parameters: [
      { name: 'prevOwner', type: 'address', value: addr() },
      { name: 'owner', type: 'address', value: owner },
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

function swapOwnerDecoded(
  oldOwner: Address,
  newOwner: Address,
): BaseDataDecoded {
  return {
    method: 'swapOwner',
    parameters: [
      { name: 'prevOwner', type: 'address', value: addr() },
      { name: 'oldOwner', type: 'address', value: oldOwner },
      { name: 'newOwner', type: 'address', value: newOwner },
    ],
  } as BaseDataDecoded;
}

function changeThresholdDecoded(threshold: number): BaseDataDecoded {
  return {
    method: 'changeThreshold',
    parameters: [
      { name: '_threshold', type: 'uint256', value: String(threshold) },
    ],
  } as BaseDataDecoded;
}

function tx(
  to: Address,
  dataDecoded: BaseDataDecoded | null,
): { to: Address; dataDecoded: BaseDataDecoded | null } {
  return { to, dataDecoded };
}

describe('isOwnerConfigTransaction', () => {
  it('should return true for addOwnerWithThreshold', () => {
    const dataDecoded = {
      method: 'addOwnerWithThreshold',
      parameters: [],
    } as BaseDataDecoded;
    expect(isOwnerConfigTransaction(dataDecoded)).toBe(true);
  });

  it('should return true for removeOwner', () => {
    const dataDecoded = {
      method: 'removeOwner',
      parameters: [],
    } as BaseDataDecoded;
    expect(isOwnerConfigTransaction(dataDecoded)).toBe(true);
  });

  it('should return true for swapOwner', () => {
    const dataDecoded = {
      method: 'swapOwner',
      parameters: [],
    } as BaseDataDecoded;
    expect(isOwnerConfigTransaction(dataDecoded)).toBe(true);
  });

  it('should return true for changeThreshold', () => {
    const dataDecoded = {
      method: 'changeThreshold',
      parameters: [],
    } as BaseDataDecoded;
    expect(isOwnerConfigTransaction(dataDecoded)).toBe(true);
  });

  it('should return false for non-owner-config transaction', () => {
    const dataDecoded = {
      method: 'transfer',
      parameters: [],
    } as BaseDataDecoded;
    expect(isOwnerConfigTransaction(dataDecoded)).toBe(false);
  });

  it('should return false for null dataDecoded', () => {
    expect(isOwnerConfigTransaction(null)).toBe(false);
  });
});

describe('computeProjectedState', () => {
  const owner1 = getAddress(faker.finance.ethereumAddress());
  const owner2 = getAddress(faker.finance.ethereumAddress());
  const newOwner = getAddress(faker.finance.ethereumAddress());

  it('should add owner and set threshold for addOwnerWithThreshold', () => {
    const result = computeProjectedState({
      currentOwners: [owner1, owner2],
      currentThreshold: 1,
      dataDecoded: {
        method: 'addOwnerWithThreshold',
        parameters: [
          { name: 'owner', type: 'address', value: newOwner },
          { name: '_threshold', type: 'uint256', value: '2' },
        ],
      } as BaseDataDecoded,
    });

    expect(result.owners).toHaveLength(3);
    expect(result.owners).toContain(newOwner);
    expect(result.threshold).toBe(2);
  });

  it('should remove owner and set threshold for removeOwner', () => {
    const result = computeProjectedState({
      currentOwners: [owner1, owner2],
      currentThreshold: 2,
      dataDecoded: {
        method: 'removeOwner',
        parameters: [
          {
            name: 'prevOwner',
            type: 'address',
            value: getAddress(faker.finance.ethereumAddress()),
          },
          { name: 'owner', type: 'address', value: owner2 },
          { name: '_threshold', type: 'uint256', value: '1' },
        ],
      } as BaseDataDecoded,
    });

    expect(result.owners).toHaveLength(1);
    expect(result.owners).not.toContain(owner2);
    expect(result.threshold).toBe(1);
  });

  it('should swap owner for swapOwner (threshold unchanged)', () => {
    const result = computeProjectedState({
      currentOwners: [owner1, owner2],
      currentThreshold: 2,
      dataDecoded: {
        method: 'swapOwner',
        parameters: [
          {
            name: 'prevOwner',
            type: 'address',
            value: getAddress(faker.finance.ethereumAddress()),
          },
          { name: 'oldOwner', type: 'address', value: owner1 },
          { name: 'newOwner', type: 'address', value: newOwner },
        ],
      } as BaseDataDecoded,
    });

    expect(result.owners).toHaveLength(2);
    expect(result.owners).not.toContain(owner1);
    expect(result.owners).toContain(newOwner);
    expect(result.threshold).toBe(2);
  });

  it('should change threshold only for changeThreshold', () => {
    const result = computeProjectedState({
      currentOwners: [owner1, owner2],
      currentThreshold: 2,
      dataDecoded: {
        method: 'changeThreshold',
        parameters: [{ name: '_threshold', type: 'uint256', value: '1' }],
      } as BaseDataDecoded,
    });

    expect(result.owners).toEqual([owner1, owner2]);
    expect(result.threshold).toBe(1);
  });

  it('should throw when a required parameter is missing', () => {
    expect(() =>
      computeProjectedState({
        currentOwners: [owner1, owner2],
        currentThreshold: 1,
        dataDecoded: {
          method: 'addOwnerWithThreshold',
          parameters: [
            { name: 'owner', type: 'address', value: newOwner },
            // Missing '_threshold' parameter
          ],
        } as BaseDataDecoded,
      }),
    ).toThrow("Parameter '_threshold' not found");
  });
});

describe('groupOwnerConfigsByTarget', () => {
  it('should group transactions targeting 2 different Safes', () => {
    const safeA = addr();
    const safeB = addr();
    const addOwnerA = addOwnerDecoded(addr(), 2);
    const removeOwnerB = removeOwnerDecoded(addr(), 1);

    const result = groupOwnerConfigsByTarget([
      tx(safeA, addOwnerA),
      tx(safeB, removeOwnerB),
    ]);

    expect(result.size).toBe(2);
    expect(result.get(safeA)).toEqual([addOwnerA]);
    expect(result.get(safeB)).toEqual([removeOwnerB]);
  });

  it('should return empty map for no owner config transactions', () => {
    const result = groupOwnerConfigsByTarget([
      tx(addr(), null),
      tx(addr(), {
        method: 'transfer',
        parameters: [],
      } as BaseDataDecoded),
    ]);

    expect(result.size).toBe(0);
  });

  it('should preserve order within each group', () => {
    const safe = addr();
    const first = addOwnerDecoded(addr(), 2);
    const second = changeThresholdDecoded(3);
    const third = removeOwnerDecoded(addr(), 1);

    const result = groupOwnerConfigsByTarget([
      tx(safe, first),
      tx(safe, second),
      tx(safe, third),
    ]);

    expect(result.size).toBe(1);
    expect(result.get(safe)).toEqual([first, second, third]);
  });

  it('should normalize addresses via getAddress()', () => {
    const rawAddress = '0xabcdef1234567890abcdef1234567890abcdef12' as Address;
    const normalizedAddress = getAddress(rawAddress);
    const decoded = addOwnerDecoded(addr(), 1);

    const result = groupOwnerConfigsByTarget([tx(rawAddress, decoded)]);

    expect(result.size).toBe(1);
    expect(result.has(normalizedAddress)).toBe(true);
    expect(result.has(rawAddress)).toBe(false);
  });

  it('should ignore non-owner-config transactions in mixed batch', () => {
    const safe = addr();
    const otherAddr = addr();
    const ownerConfig = addOwnerDecoded(addr(), 2);

    const result = groupOwnerConfigsByTarget([
      tx(otherAddr, null),
      tx(otherAddr, { method: 'transfer', parameters: [] } as BaseDataDecoded),
      tx(safe, ownerConfig),
      tx(otherAddr, {
        method: 'approve',
        parameters: [],
      } as BaseDataDecoded),
    ]);

    expect(result.size).toBe(1);
    expect(result.get(safe)).toEqual([ownerConfig]);
  });

  it('should handle single Safe with one operation', () => {
    const safe = addr();
    const decoded = swapOwnerDecoded(addr(), addr());

    const result = groupOwnerConfigsByTarget([tx(safe, decoded)]);

    expect(result.size).toBe(1);
    expect(result.get(safe)).toEqual([decoded]);
  });

  it('should deduplicate same Safe with multiple operations into single group', () => {
    const safe = addr();
    const op1 = addOwnerDecoded(addr(), 2);
    const op2 = changeThresholdDecoded(3);

    const result = groupOwnerConfigsByTarget([tx(safe, op1), tx(safe, op2)]);

    expect(result.size).toBe(1);
    expect(result.get(safe)).toEqual([op1, op2]);
  });

  it('should return empty map for empty transaction list', () => {
    const result = groupOwnerConfigsByTarget([]);

    expect(result.size).toBe(0);
  });

  it('should handle all four owner config method types', () => {
    const safe = addr();
    const add = addOwnerDecoded(addr(), 2);
    const remove = removeOwnerDecoded(addr(), 1);
    const swap = swapOwnerDecoded(addr(), addr());
    const threshold = changeThresholdDecoded(3);

    const result = groupOwnerConfigsByTarget([
      tx(safe, add),
      tx(safe, remove),
      tx(safe, swap),
      tx(safe, threshold),
    ]);

    expect(result.size).toBe(1);
    expect(result.get(safe)).toEqual([add, remove, swap, threshold]);
  });
});
