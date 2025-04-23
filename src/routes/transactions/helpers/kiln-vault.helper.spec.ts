import { faker } from '@faker-js/faker';
import { shuffle } from 'lodash';
import { getAddress } from 'viem';

import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { KilnVaultHelper } from '@/routes/transactions/helpers/kiln-vault.helper';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import {
  erc4262DepositEncoder,
  erc4262WithdrawEncoder,
} from '@/routes/transactions/__tests__/encoders/erc4262-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { execTransactionEncoder } from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('KilnVaultHelper', () => {
  let target: KilnVaultHelper;

  beforeEach(() => {
    jest.resetAllMocks();

    const multiSendDecoder = new MultiSendDecoder(mockLoggingService);
    const transactionFinder = new TransactionFinder(multiSendDecoder);
    target = new KilnVaultHelper(transactionFinder);
  });

  describe('getVaultDepositTransaction', () => {
    it('should decode a vault deposit transaction', () => {
      const deposit = erc4262DepositEncoder();
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const args = deposit.build();
      const data = deposit.encode();

      const transaction = target.getVaultDepositTransaction({
        to,
        data,
        value,
      });

      expect(transaction).toEqual({
        to,
        data,
        value,
        assets: Number(args.assets),
      });
    });

    it('should decode a batched vault deposit transaction', () => {
      const deposit = erc4262DepositEncoder();
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const args = deposit.build();
      const data = deposit.encode();
      const transactions = [
        ...faker.helpers.multiple(
          () => {
            return {
              operation: faker.number.int({ min: 0, max: 1 }),
              to: getAddress(faker.finance.ethereumAddress()),
              value: faker.number.bigInt(),
              data: execTransactionEncoder().encode(),
            };
          },
          { count: { min: 1, max: 5 } },
        ),
        {
          operation: faker.number.int({ min: 0, max: 1 }),
          to,
          value: BigInt(value),
          data,
        },
      ];
      const multiSend = multiSendEncoder().with(
        'transactions',
        multiSendTransactionsEncoder(transactions),
      );

      const transaction = target.getVaultDepositTransaction({
        to,
        data: multiSend.encode(),
        value,
      });

      expect(transaction).toEqual({
        to,
        data,
        value,
        assets: Number(args.assets),
      });
    });

    it('should return null if there is no data', () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();

      const transaction = target.getVaultDepositTransaction({
        to,
        data: null,
        value,
      });

      expect(transaction).toBeNull();
    });

    it('should return null if there is no value', () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const data = erc4262DepositEncoder().encode();

      const transaction = target.getVaultDepositTransaction({
        to,
        data,
        value: null,
      });

      expect(transaction).toBeNull();
    });

    it('should return null if no deposit transaction is found', () => {
      const transactions = faker.helpers.multiple(
        () => {
          return {
            operation: faker.number.int({ min: 0, max: 1 }),
            to: getAddress(faker.finance.ethereumAddress()),
            value: faker.number.bigInt(),
            data: execTransactionEncoder().encode(),
          };
        },
        { count: { min: 1, max: 5 } },
      );
      const multiSend = multiSendEncoder().with(
        'transactions',
        multiSendTransactionsEncoder(shuffle(transactions)),
      );

      const transaction = target.getVaultDepositTransaction({
        to: getAddress(faker.finance.ethereumAddress()),
        data: multiSend.encode(),
        value: faker.string.numeric(),
      });

      expect(transaction).toBeNull();
    });

    it('should return null if the transaction is not a deposit', () => {
      const withdraw = erc4262WithdrawEncoder();
      const to = getAddress(faker.finance.ethereumAddress());
      const value = faker.string.numeric();
      const data = withdraw.encode();
      const transactions = [
        ...faker.helpers.multiple(
          () => {
            return {
              operation: faker.number.int({ min: 0, max: 1 }),
              to: getAddress(faker.finance.ethereumAddress()),
              value: faker.number.bigInt(),
              data: execTransactionEncoder().encode(),
            };
          },
          { count: { min: 1, max: 5 } },
        ),
        {
          operation: faker.number.int({ min: 0, max: 1 }),
          to,
          value: BigInt(value),
          data,
        },
      ];
      const multiSend = multiSendEncoder().with(
        'transactions',
        multiSendTransactionsEncoder(shuffle(transactions)),
      );

      const transaction = target.getVaultDepositTransaction({
        to,
        data: multiSend.encode(),
        value,
      });

      expect(transaction).toBeNull();
    });
  });
});
