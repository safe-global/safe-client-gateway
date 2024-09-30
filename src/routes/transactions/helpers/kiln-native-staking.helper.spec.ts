import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import { faker } from '@faker-js/faker';
import { concat } from 'viem';

describe('KilnNativeStakingHelper', () => {
  let target: KilnNativeStakingHelper;

  beforeEach(() => {
    jest.resetAllMocks();

    const multiSendDecoder = new MultiSendDecoder();
    const transactionFinder = new TransactionFinder(multiSendDecoder);
    target = new KilnNativeStakingHelper(transactionFinder);
  });

  describe('findDepositTransaction', () => {
    it.todo('should return a `deposit` transaction');

    it.todo('should return a batched `deposit` transaction');

    it.todo(
      'should return null if a `deposit` transaction is not from a known staking contract',
    );

    it.todo(
      'should return null if a batched `deposit` transaction is not from a known staking contract',
    );

    it.todo(
      'should return null if the transaction is not a `deposit` transaction',
    );

    it.todo(
      'should return null if the transaction batch contains no `deposit` transaction',
    );
  });

  describe('findValidatorsExitTransaction', () => {
    it.todo('should return a `requestValidatorsExit` transaction');

    it.todo('should return a batched `requestValidatorsExit` transaction');

    it.todo(
      'should return null if a `requestValidatorsExit` transaction is not from a known staking contract',
    );

    it.todo(
      'should return null if a requestValidatorsExit `deposit` transaction is not from a known staking contract',
    );

    it.todo(
      'should return null if the transaction is not a `requestValidatorsExit` transaction',
    );

    it.todo(
      'should return null if the transaction batch contains no `requestValidatorsExit` transaction',
    );
  });

  describe('findWithdrawTransaction', () => {
    it.todo('should return a `batchWithdrawCLFee` transaction');

    it.todo('should return a batched `batchWithdrawCLFee` transaction');

    it.todo(
      'should return null if a `batchWithdrawCLFee` transaction is not from a known staking contract',
    );

    it.todo(
      'should return null if a batchWithdrawCLFee `deposit` transaction is not from a known staking contract',
    );

    it.todo(
      'should return null if the transaction is not a `batchWithdrawCLFee` transaction',
    );

    it.todo(
      'should return null if the transaction batch contains no `batchWithdrawCLFee` transaction',
    );
  });

  describe('splitPublicKeys', () => {
    it('should split the _publicKeys into an array of strings of correct length', () => {
      const validators = [
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          casing: 'lower',
        }),
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          casing: 'lower',
        }),
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          casing: 'lower',
        }),
      ] as Array<`0x${string}`>;
      const _publicKeys = concat(validators);

      const result = target.splitPublicKeys(_publicKeys);

      expect(result).toStrictEqual(validators);
    });
  });
});
