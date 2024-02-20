import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/encoders/safe-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/encoders/multi-send-encoder.builder';
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
  });

  describe('isMultiSend', () => {
    it('returns true if data is a multiSend call', () => {
      const data = multiSendEncoder().encode();
      expect(target.isMultiSend(data)).toBe(true);
    });

    it('returns false if data is not a multiSend call', () => {
      const data = addOwnerWithThresholdEncoder().encode();
      expect(target.isMultiSend(data)).toBe(false);
    });
  });
});
