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
      const example1 =
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000aa00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000005af3107a4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000038d7ea4c68000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      // Sepolia txHash 0xa5dd2ebff8c270268f218c70e3aaae29f9570cf2a29fb4bdb17638653852b064
      const example2 =
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000aa0006373d5e45ad31bd354cebfa8db4ed2c75b8708e000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000000006373d5e45ad31bd354cebfa8db4ed2c75b8708e00000000000000000000000000000000000000000000000000b1a2bc2ec50000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
      // Sepolia txHash 0x833ee631f939f149b3fe7f30beec0fb89b40ee327f84a22cc7d86eac5793b88c
      const example3 =
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000aa0006373d5e45ad31bd354cebfa8db4ed2c75b8708e00000000000000000000000000000000000000000000000000000000001e848000000000000000000000000000000000000000000000000000000000000000000006373d5e45ad31bd354cebfa8db4ed2c75b8708e00000000000000000000000000000000000000000000000000000000001e8480000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

      expect(target.mapMultiSendTransactions(example1)).toStrictEqual([
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
      expect(target.mapMultiSendTransactions(example2)).toStrictEqual([
        {
          data: '0x',
          operation: 0,
          to: '0x06373d5e45AD31BD354CeBfA8dB4eD2c75B8708e',
          value: BigInt('10000000000000000'),
        },
        {
          data: '0x',
          operation: 0,
          to: '0x06373d5e45AD31BD354CeBfA8dB4eD2c75B8708e',
          value: BigInt('50000000000000000'),
        },
      ]);
      expect(target.mapMultiSendTransactions(example3)).toStrictEqual([
        {
          data: '0x',
          operation: 0,
          to: '0x06373d5e45AD31BD354CeBfA8dB4eD2c75B8708e',
          value: BigInt('2000000'),
        },
        {
          data: '0x',
          operation: 0,
          to: '0x06373d5e45AD31BD354CeBfA8dB4eD2c75B8708e',
          value: BigInt('2000000'),
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
