import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import { faker } from '@faker-js/faker';
import { concat, getAddress } from 'viem';

const mockStakingRepository = jest.mocked({
  getStakes: jest.fn(),
} as jest.MockedObjectDeep<StakingRepository>);

describe('KilnNativeStakingHelper', () => {
  let target: KilnNativeStakingHelper;

  beforeEach(() => {
    jest.resetAllMocks();

    const multiSendDecoder = new MultiSendDecoder();
    const transactionFinder = new TransactionFinder(multiSendDecoder);
    target = new KilnNativeStakingHelper(
      transactionFinder,
      mockStakingRepository,
    );
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

  describe('getValueFromDataDecoded', () => {
    it('should throw if the decoded data is not of a `requestValidatorsExit` or `batchWithdrawCLFee` transaction', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'deposit')
        .with('parameters', [])
        .build();

      await expect(() =>
        target.getValueFromDataDecoded({
          chainId,
          safeAddress,
          dataDecoded,
        }),
      ).rejects.toThrow('deposit does not contain _publicKeys');
    });

    it('should return 0 if no public keys are found in the decoded data', async () => {
      const method = faker.helpers.arrayElement([
        'requestValidatorsExit',
        'batchWithdrawCLFee',
      ]);
      const dataDecoded = dataDecodedBuilder()
        .with('method', method)
        .with('parameters', [])
        .build();

      const result = await target.getValueFromDataDecoded({
        chainId: faker.string.numeric(),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
        dataDecoded,
      });

      expect(result).toBe(0);
    });

    it('should return the total claimable value for all public keys', async () => {
      const method = faker.helpers.arrayElement([
        'requestValidatorsExit',
        'batchWithdrawCLFee',
      ]);
      const validators = [
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          // Transaction Service returns _publicKeys lowercase
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
      const dataDecoded = dataDecodedBuilder()
        .with('method', method)
        .with('parameters', [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: _publicKeys,
            valueDecoded: null,
          },
        ])
        .build();
      const stakes = [
        stakeBuilder().build(),
        stakeBuilder().build(),
        stakeBuilder().build(),
      ];
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const result = await target.getValueFromDataDecoded({
        chainId: faker.string.numeric(),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
        dataDecoded,
      });

      expect(result).toBe(
        +stakes[0].net_claimable_consensus_rewards! +
          +stakes[1].net_claimable_consensus_rewards! +
          +stakes[2].net_claimable_consensus_rewards!,
      );
    });
  });

  describe('getPublicKeysFromDataDecoded', () => {
    it('should throw if the decoded data is not of a `requestValidatorsExit` or `batchWithdrawCLFee` transaction', () => {
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'deposit')
        .with('parameters', [])
        .build();

      expect(() => target.getPublicKeysFromDataDecoded(dataDecoded)).toThrow(
        'deposit does not contain _publicKeys',
      );
    });

    it('should return an empty array if no parameters are found', () => {
      const method = faker.helpers.arrayElement([
        'requestValidatorsExit',
        'batchWithdrawCLFee',
      ]);
      const dataDecoded = dataDecodedBuilder()
        .with('method', method)
        .with('parameters', [])
        .build();

      const result = target.getPublicKeysFromDataDecoded(dataDecoded);

      expect(result).toStrictEqual([]);
    });

    it('should return an array of split public keys if hex _publicKeys parameter is found', () => {
      const method = faker.helpers.arrayElement([
        'requestValidatorsExit',
        'batchWithdrawCLFee',
      ]);
      const validators = [
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          // Transaction Service returns _publicKeys lowercase
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
      const dataDecoded = dataDecodedBuilder()
        .with('method', method)
        .with('parameters', [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: _publicKeys,
            valueDecoded: null,
          },
        ])
        .build();

      const result = target.getPublicKeysFromDataDecoded(dataDecoded);

      expect(result).toStrictEqual(validators);
    });

    it('should return an empty array if non-hex _publicKeys is found', () => {
      const method = faker.helpers.arrayElement([
        'requestValidatorsExit',
        'batchWithdrawCLFee',
      ]);
      const _publicKeys = faker.string.alpha({
        length: KilnDecoder.KilnPublicKeyLength,
      }) as `0x${string}`;
      const dataDecoded = dataDecodedBuilder()
        .with('method', method)
        .with('parameters', [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: _publicKeys,
            valueDecoded: null,
          },
        ])
        .build();

      const result = target.getPublicKeysFromDataDecoded(dataDecoded);

      expect(result).toStrictEqual([]);
    });
  });

  describe('splitPublicKeys', () => {
    it('should split the _publicKeys into an array of strings of correct length', () => {
      const validators = [
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
          // Transaction Service returns _publicKeys lowercase
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
