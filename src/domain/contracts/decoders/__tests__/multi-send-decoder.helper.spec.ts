import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';

describe('MultiSendDecoder', () => {
  let target: MultiSendDecoder;

  beforeEach(() => {
    target = new MultiSendDecoder();
  });

  describe('mapMultiSendTransactions', () => {
    it('maps multiSend transactions correctly', () => {
      const safe = safeBuilder().build();
      const transactions = [
        addOwnerWithThresholdEncoder().encode(),
        removeOwnerEncoder(safe.owners).encode(),
        swapOwnerEncoder(safe.owners).encode(),
        changeThresholdEncoder().encode(),
      ].map((data) => ({
        operation: faker.number.int({ min: 0, max: 1 }),
        data,
        // Normally static (0/0) but more robust if we generate random values
        to: getAddress(safe.address),
        value: faker.number.bigInt(),
      }));

      const encodedTransactions = multiSendTransactionsEncoder(transactions);

      const data = multiSendEncoder()
        .with('transactions', encodedTransactions)
        .encode();

      expect(target.mapMultiSendTransactions(data)).toStrictEqual(transactions);
    });

    it('maps empty multiSend transactions correctly (real world edge case)', () => {
      // Sepolia txHash 0x456d10fa3aff95195177f9c6593a38c612f26854ccd4ae69dd585aa1b9486790
      const encodedTransactions =
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000aa00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005af3107a4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000038d7ea4c68000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

      expect(
        target.mapMultiSendTransactions(encodedTransactions),
      ).toStrictEqual([
        {
          data: '0x',
          operation: 0,
          to: '0x0000000000000000000000000000000000000000',
          value: BigInt('100000000000000'),
        },
        {
          data: '0x',
          operation: 0,
          to: '0x0000000000000000000000000000000000000000',
          value: BigInt('1000000000000000'),
        },
      ]);
    });
  });

  describe('isMultiSend', () => {
    it('returns true if data is a multiSend call', () => {
      const data = multiSendEncoder().encode();
      expect(target.helpers.isMultiSend(data)).toBe(true);
    });

    it('returns false if data is not a multiSend call', () => {
      const data = addOwnerWithThresholdEncoder().encode();
      expect(target.helpers.isMultiSend(data)).toBe(false);
    });
  });
});
