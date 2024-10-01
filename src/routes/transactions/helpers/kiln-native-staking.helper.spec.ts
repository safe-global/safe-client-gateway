import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import {
  batchWithdrawCLFeeEncoder,
  depositEncoder,
  requestValidatorsExitEncoder,
} from '@/domain/staking/contracts/decoders/__tests__/encoders/kiln-encoder.builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { ILoggingService } from '@/logging/logging.interface';
import { KilnNativeStakingHelper } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import { faker } from '@faker-js/faker';
import { concat, getAddress } from 'viem';

const mockStakingRepository = jest.mocked({
  getStakes: jest.fn(),
  getDeployment: jest.fn(),
} as jest.MockedObjectDeep<StakingRepository>);

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('KilnNativeStakingHelper', () => {
  let target: KilnNativeStakingHelper;

  beforeEach(() => {
    jest.resetAllMocks();

    const multiSendDecoder = new MultiSendDecoder(mockLoggingService);
    const transactionFinder = new TransactionFinder(multiSendDecoder);
    target = new KilnNativeStakingHelper(
      transactionFinder,
      mockStakingRepository,
    );
  });

  describe.each([
    { name: 'findDepositTransaction', encoder: depositEncoder } as const,
    {
      name: 'findValidatorsExitTransaction',
      encoder: requestValidatorsExitEncoder,
    } as const,
    {
      name: 'findWithdrawTransaction',
      encoder: batchWithdrawCLFeeEncoder,
    } as const,
  ])('$name', ({ name, encoder }) => {
    it('should return a transaction', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'eth')
        .build();
      const data = encoder().encode();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        to: deployment.address,
        data,
      });

      expect(result).toStrictEqual({ to: deployment.address, data });
    });

    it('should return a batched transaction', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'eth')
        .build();
      const depositData = encoder().encode();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: 0,
              data: depositData,
              to: deployment.address,
              value: faker.number.bigInt(0),
            },
          ]),
        )
        .encode();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        // MultiSend address mock
        to: getAddress(faker.finance.ethereumAddress()),
        data,
      });

      expect(result).toStrictEqual({
        to: deployment.address,
        data: depositData,
      });
    });

    it('should return null if a transaction is not from a known staking contract', async () => {
      const chainId = faker.string.numeric();
      const data = encoder().encode();
      mockStakingRepository.getDeployment.mockRejectedValue(
        new Error('Deployment not found'),
      );

      const result = await target[name]({
        chainId,
        to: getAddress(faker.finance.ethereumAddress()),
        data,
      });

      expect(result).toBe(null);
    });

    it('should return null if a batched transaction is not from a known staking contract', async () => {
      const chainId = faker.string.numeric();
      const to = getAddress(faker.finance.ethereumAddress());
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: 0,
              data: encoder().encode(),
              to: getAddress(faker.finance.ethereumAddress()),
              value: faker.number.bigInt(0),
            },
          ]),
        )
        .encode();
      mockStakingRepository.getDeployment.mockRejectedValue(
        new Error('Deployment not found'),
      );

      const result = await target[name]({
        chainId,
        to,
        data,
      });

      expect(result).toBe(null);
    });

    it('should return a is from a known non-dedicated staking contract', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('chain', 'eth')
        .build();
      const data = encoder().encode();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        to: deployment.address,
        data,
      });

      expect(result).toBe(null);
    });

    it('should return a is from an unknown chain', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'unknown')
        .build();
      const data = encoder().encode();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        to: deployment.address,
        data,
      });

      expect(result).toBe(null);
    });

    it('should return null if a batched transaction is from a known non-dedicated staking contract', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .with('chain', 'eth')
        .build();
      const depositData = encoder().encode();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: 0,
              data: depositData,
              to: deployment.address,
              value: faker.number.bigInt(0),
            },
          ]),
        )
        .encode();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        // MultiSend address mock
        to: getAddress(faker.finance.ethereumAddress()),
        data,
      });

      expect(result).toBe(null);
    });

    it('should return null if a batched transaction is from an unknown chain', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'unknown')
        .build();
      const depositData = encoder().encode();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: 0,
              data: depositData,
              to: deployment.address,
              value: faker.number.bigInt(0),
            },
          ]),
        )
        .encode();
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        // MultiSend address mock
        to: getAddress(faker.finance.ethereumAddress()),
        data,
      });

      expect(result).toBe(null);
    });

    it('should return null if the transaction is not a transaction', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'eth')
        .build();
      const data = faker.string.hexadecimal() as `0x${string}`;

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        to: deployment.address,
        data,
      });

      expect(result).toBe(null);
    });

    it('should return null if the transaction batch contains no transaction', async () => {
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'eth')
        .build();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              operation: 0,
              data: faker.string.hexadecimal() as `0x${string}`,
              to: deployment.address,
              value: faker.number.bigInt(0),
            },
          ]),
        )
        .encode();

      const result = await target[name]({
        chainId: deployment.chain_id.toString(),
        to: deployment.address,
        data,
      });

      expect(result).toBe(null);
    });
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
