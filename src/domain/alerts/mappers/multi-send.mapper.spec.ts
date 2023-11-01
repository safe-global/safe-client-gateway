import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { MultiSendMapper } from '@/domain/alerts/mappers/multi-send.mapper';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
} from '@/domain/alerts/__tests__/safe-transactions.encoder';
import { multiSendEncoder } from '@/domain/alerts/__tests__/multisend-transactions.encoder';

describe('MultiSendMapper', () => {
  let mapper: MultiSendMapper;

  beforeEach(() => {
    mapper = new MultiSendMapper();
  });

  describe('mapMultiSendTransactions', () => {
    it('maps multiSend transactions correctly', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const transactions = [
        addOwnerWithThresholdEncoder(),
        removeOwnerEncoder(),
        swapOwnerEncoder(),
        changeThresholdEncoder(),
      ].map((data) => ({
        operation: faker.number.int({ min: 0, max: 1 }),
        data,
        // Normally static (0/0) but more robust if we generate random values
        to: safeAddress,
        value: faker.number.bigInt(),
      }));

      const data = multiSendEncoder(transactions);

      expect(mapper.mapMultiSendTransactions(data)).toStrictEqual(transactions);
    });
  });
});
