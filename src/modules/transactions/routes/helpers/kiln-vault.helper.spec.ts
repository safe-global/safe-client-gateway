// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { shuffle } from 'lodash';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { execTransactionEncoder } from '#/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  erc4262DepositEncoder,
  erc4262RedeemEncoder,
  erc4262WithdrawEncoder,
  erc4626ReferralDepositEncoder,
  erc4626ReferralMintEncoder,
} from '#/modules/transactions/routes/__tests__/encoders/erc4262-encoder.builder';
import { KilnVaultHelper } from '#/modules/transactions/routes/helpers/kiln-vault.helper';
import { TransactionFinder } from '#/modules/transactions/routes/helpers/transaction-finder.helper';

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('KilnVaultHelper', () => {
  let target: KilnVaultHelper;

  beforeEach(() => {
    vi.resetAllMocks();

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
        assets: args.assets,
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
        assets: args.assets,
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
  describe('precision and overloads', () => {
    it('should keep an 18-decimal deposit above 2^53 exact', () => {
      // 123.456789012345678901 tokens with 18 decimals
      const assets = BigInt('123456789012345678901');
      expect(assets > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
      const deposit = erc4262DepositEncoder().with('assets', assets);

      const transaction = target.getVaultDepositTransaction({
        to: getAddress(faker.finance.ethereumAddress()),
        data: deposit.encode(),
        value: '0',
      });

      expect(transaction?.assets).toBe(assets);
      expect(transaction?.assets.toString()).toBe('123456789012345678901');
    });

    it('should decode a deposit with a uint16 referral', () => {
      const deposit = erc4626ReferralDepositEncoder();
      const args = deposit.build();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = deposit.encode();

      expect(
        target.getVaultDepositTransaction({ to, data, value: '0' }),
      ).toEqual({ to, data, value: '0', assets: args.amount });
      expect(
        target.findVaultCall({ transaction: { to, data, value: '0' } }),
      ).toEqual({
        to,
        data,
        value: '0',
        method: 'deposit',
        assets: args.amount,
        receiver: args.receiver,
        referral: args.referral,
      });
    });

    it('should decode a mint with a uint16 referral', () => {
      const mint = erc4626ReferralMintEncoder();
      const args = mint.build();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = mint.encode();

      expect(
        target.findVaultCall({ transaction: { to, data, value: '0' } }),
      ).toEqual({
        to,
        data,
        value: '0',
        method: 'mint',
        shares: args.amount,
        receiver: args.receiver,
        referral: args.referral,
      });
    });

    it('should set referral to null for a standard deposit', () => {
      const deposit = erc4262DepositEncoder();
      const args = deposit.build();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = deposit.encode();

      expect(
        target.findVaultCall({ transaction: { to, data, value: '0' } }),
      ).toEqual({
        to,
        data,
        value: '0',
        method: 'deposit',
        assets: args.assets,
        receiver: args.receiver,
        referral: null,
      });
    });

    it('should not find a deposit when only other methods are searched', () => {
      const data = erc4626ReferralDepositEncoder().encode();

      expect(
        target.findVaultCall({
          transaction: {
            to: getAddress(faker.finance.ethereumAddress()),
            data,
            value: '0',
          },
          methods: ['redeem', 'withdraw'],
        }),
      ).toBeNull();
    });
  });

  describe('getVaultRedeemOrWithdrawTransaction', () => {
    it('should expose shares, not assets, for a redeem', () => {
      const shares = faker.number.bigInt({ min: 1n });
      const redeem = erc4262RedeemEncoder().with('shares', shares);
      const args = redeem.build();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = redeem.encode();

      const transaction = target.getVaultRedeemOrWithdrawTransaction({
        to,
        data,
        value: '0',
      });

      expect(transaction).toEqual({
        to,
        data,
        value: '0',
        method: 'redeem',
        shares,
        receiver: args.receiver,
        owner: args.owner,
      });
      expect(transaction).not.toHaveProperty('assets');
    });

    it('should expose assets for a withdraw', () => {
      const withdraw = erc4262WithdrawEncoder();
      const args = withdraw.build();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = withdraw.encode();

      expect(
        target.getVaultRedeemOrWithdrawTransaction({ to, data, value: '0' }),
      ).toEqual({
        to,
        data,
        value: '0',
        method: 'withdraw',
        assets: args.assets,
        receiver: args.receiver,
        owner: args.owner,
      });
    });

    it('should return null for a deposit', () => {
      expect(
        target.getVaultRedeemOrWithdrawTransaction({
          to: getAddress(faker.finance.ethereumAddress()),
          data: erc4262DepositEncoder().encode(),
          value: '0',
        }),
      ).toBeNull();
    });
  });
});
