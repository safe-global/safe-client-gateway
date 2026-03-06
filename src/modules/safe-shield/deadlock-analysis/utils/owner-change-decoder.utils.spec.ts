import { getAddress } from 'viem';
import {
  isOwnerChangeTransaction,
  computeProjectedState,
} from './owner-change-decoder.utils';
import { faker } from '@faker-js/faker';
import type { BaseDataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';

describe('owner-change-decoder.utils', () => {
  describe('isOwnerChangeTransaction', () => {
    it('should return true for addOwnerWithThreshold', () => {
      const dataDecoded = {
        method: 'addOwnerWithThreshold',
        parameters: [],
      } as BaseDataDecoded;
      expect(isOwnerChangeTransaction(dataDecoded)).toBe(true);
    });

    it('should return true for removeOwner', () => {
      const dataDecoded = {
        method: 'removeOwner',
        parameters: [],
      } as BaseDataDecoded;
      expect(isOwnerChangeTransaction(dataDecoded)).toBe(true);
    });

    it('should return true for swapOwner', () => {
      const dataDecoded = {
        method: 'swapOwner',
        parameters: [],
      } as BaseDataDecoded;
      expect(isOwnerChangeTransaction(dataDecoded)).toBe(true);
    });

    it('should return true for changeThreshold', () => {
      const dataDecoded = {
        method: 'changeThreshold',
        parameters: [],
      } as BaseDataDecoded;
      expect(isOwnerChangeTransaction(dataDecoded)).toBe(true);
    });

    it('should return false for non-owner-change transaction', () => {
      const dataDecoded = {
        method: 'transfer',
        parameters: [],
      } as BaseDataDecoded;
      expect(isOwnerChangeTransaction(dataDecoded)).toBe(false);
    });

    it('should return false for null dataDecoded', () => {
      expect(isOwnerChangeTransaction(null)).toBe(false);
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
  });
});
