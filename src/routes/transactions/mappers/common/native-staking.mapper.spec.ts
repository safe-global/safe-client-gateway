import {
  dedicatedStakingStatsBuilder,
  dedicatedStakingStatsGrossApyBuilder,
} from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { faker } from '@faker-js/faker';

const mockStakingRepository = jest.mocked({
  getDeployment: jest.fn(),
  getDedicatedStakingStats: jest.fn(),
  getNetworkStats: jest.fn(),
  getStakes: jest.fn(),
} as jest.MockedObjectDeep<StakingRepository>);

const mockChainsRepository = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<ChainsRepository>);

describe('NativeStakingMapper', () => {
  let target: NativeStakingMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    target = new NativeStakingMapper(
      mockStakingRepository,
      mockChainsRepository,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('mapDepositInfo', () => {
    it('should map a native staking deposit info with SignatureNeeded status', async () => {
      const chain = chainBuilder().build();
      const productFee = '0.5';
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('product_fee', productFee)
        .build();
      const networkStats = networkStatsBuilder()
        .with('eth_price_usd', 10_000)
        .build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder()
        .with(
          'gross_apy',
          dedicatedStakingStatsGrossApyBuilder().with('last_30d', 3).build(),
        )
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: deployment.address,
        value: '64000000000000000000',
        isConfirmed: false, // not confirmed
        depositExecutionDate: null,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingDeposit',
          status: 'SIGNATURE_NEEDED',
          estimatedEntryTime: networkStats.estimated_entry_time_seconds,
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          fee: 0.5,
          monthlyNrr: 1.5 / 12,
          annualNrr: 1.5,
          value: '64000000000000000000',
          numValidators: 2,
          expectedAnnualReward: '960000000000000000',
          expectedMonthlyReward: '80000000000000000',
          expectedFiatAnnualReward: 9600,
          expectedFiatMonthlyReward: 800,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should map a native staking deposit info with AwaitingExecution status', async () => {
      const chain = chainBuilder().build();
      const productFee = '0.5';
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('product_fee', productFee)
        .build();
      const networkStats = networkStatsBuilder()
        .with('eth_price_usd', 10_000)
        .build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder()
        .with(
          'gross_apy',
          dedicatedStakingStatsGrossApyBuilder().with('last_30d', 3).build(),
        )
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: deployment.address,
        value: '64000000000000000000',
        isConfirmed: true, // confirmed
        depositExecutionDate: null, // not executed
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingDeposit',
          status: 'AWAITING_EXECUTION',
          estimatedEntryTime: networkStats.estimated_entry_time_seconds,
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          fee: 0.5,
          monthlyNrr: 1.5 / 12,
          annualNrr: 1.5,
          value: '64000000000000000000',
          numValidators: 2,
          expectedAnnualReward: '960000000000000000',
          expectedMonthlyReward: '80000000000000000',
          expectedFiatAnnualReward: 9600,
          expectedFiatMonthlyReward: 800,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should map a native staking deposit info with AwaitingEntry status', async () => {
      const chain = chainBuilder().build();
      const productFee = '0.5';
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('product_fee', productFee)
        .build();
      const networkStats = networkStatsBuilder()
        .with('eth_price_usd', 10_000)
        .with('estimated_entry_time_seconds', 2)
        .build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder()
        .with(
          'gross_apy',
          dedicatedStakingStatsGrossApyBuilder().with('last_30d', 3).build(),
        )
        .build();
      const depositExecutionDate = jest.now();
      jest.advanceTimersByTime(1_000);
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: deployment.address,
        value: '64000000000000000000',
        isConfirmed: true, // confirmed
        depositExecutionDate: new Date(depositExecutionDate), // execution date < now + entry period
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingDeposit',
          status: 'AWAITING_ENTRY',
          estimatedEntryTime: networkStats.estimated_entry_time_seconds,
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          fee: 0.5,
          monthlyNrr: 1.5 / 12,
          annualNrr: 1.5,
          value: '64000000000000000000',
          numValidators: 2,
          expectedAnnualReward: '960000000000000000',
          expectedMonthlyReward: '80000000000000000',
          expectedFiatAnnualReward: 9600,
          expectedFiatMonthlyReward: 800,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should map a native staking deposit info with ValidationStarted status', async () => {
      const chain = chainBuilder().build();
      const productFee = '0.5';
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('product_fee', productFee)
        .build();
      const networkStats = networkStatsBuilder()
        .with('eth_price_usd', 10_000)
        .with('estimated_entry_time_seconds', 1)
        .build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder()
        .with(
          'gross_apy',
          dedicatedStakingStatsGrossApyBuilder().with('last_30d', 3).build(),
        )
        .build();
      const depositExecutionDate = jest.now();
      jest.advanceTimersByTime(2_000);
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: deployment.address,
        value: '64000000000000000000',
        isConfirmed: true, // confirmed
        depositExecutionDate: new Date(depositExecutionDate), // execution date > now + entry period
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingDeposit',
          status: 'VALIDATION_STARTED',
          estimatedEntryTime: networkStats.estimated_entry_time_seconds,
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          fee: 0.5,
          monthlyNrr: 1.5 / 12,
          annualNrr: 1.5,
          value: '64000000000000000000',
          numValidators: 2,
          expectedAnnualReward: '960000000000000000',
          expectedMonthlyReward: '80000000000000000',
          expectedFiatAnnualReward: 9600,
          expectedFiatMonthlyReward: 800,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should fail if the deployment type is not `dedicated`', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .build();
      const networkStats = networkStatsBuilder().build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: deployment.address,
          value: '64000000000000000000',
          isConfirmed: false,
          depositExecutionDate: null,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });

    it('should fail if the deployment chain is unknown', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'unknown')
        .build();
      const networkStats = networkStatsBuilder().build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();

      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: deployment.address,
          value: '64000000000000000000',
          isConfirmed: false,
          depositExecutionDate: null,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });

    it('should fail if the deployment status is unknown', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('status', 'unknown')
        .build();
      const networkStats = networkStatsBuilder().build();
      const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();

      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );

      await expect(
        target.mapDepositInfo({
          chainId: chain.chainId,
          to: deployment.address,
          value: '64000000000000000000',
          isConfirmed: false,
          depositExecutionDate: null,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });
  });

  describe('mapValidatorsExitInfo', () => {
    it('should map a native staking validators exit info with SignatureNeeded status', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .build();
      const networkStats = networkStatsBuilder().build();
      const stakes = [stakeBuilder().build()];
      const validatorPublicKey = faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength * 3,
      }); // 3 validators
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'requestValidatorsExit')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', '_publicKeys')
            .with('type', 'bytes')
            .with('value', validatorPublicKey)
            .build(),
        ])
        .build();
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', 2) // 2 confirmations required
        .with('confirmations', [confirmationBuilder().build()]) // only 1 confirmation
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapValidatorsExitInfo({
        chainId: chain.chainId,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingValidatorsExit',
          status: 'SIGNATURE_NEEDED',
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          value: '96000000000000000000', // 3 public keys in the transaction data => 3 validators * 32 eth
          numValidators: 3, // 3 public keys in the transaction data => 3 validators
          rewards: stakes[0].rewards,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should map a native staking validators exit info with RequestPending status', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .build();
      const networkStats = networkStatsBuilder().build();
      const stakes = [
        stakeBuilder().with('rewards', '2').build(),
        stakeBuilder().with('rewards', '3').build(),
      ];
      const validatorPublicKey = faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength * 3,
      }); // 3 validators
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'requestValidatorsExit')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', '_publicKeys')
            .with('type', 'bytes')
            .with('value', validatorPublicKey)
            .build(),
        ])
        .build();
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', 2) // 2 confirmations required
        .with('confirmations', [
          confirmationBuilder().build(),
          confirmationBuilder().build(),
        ]) // 2 confirmations received
        .with('executionDate', null) // not executed
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapValidatorsExitInfo({
        chainId: chain.chainId,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingValidatorsExit',
          status: 'AWAITING_EXECUTION',
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          value: '96000000000000000000', // 3 public keys in the transaction data => 3 validators * 32 eth
          numValidators: 3, // 3 public keys in the transaction data => 3 validators
          rewards: '5',
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should map a native staking validators exit info with RequestPending status', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .build();
      const networkStats = networkStatsBuilder()
        .with('estimated_exit_time_seconds', 2)
        .build();
      const stakes = [stakeBuilder().build()];
      const validatorPublicKey = faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength * 3,
      }); // 3 validators
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'requestValidatorsExit')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', '_publicKeys')
            .with('type', 'bytes')
            .with('value', validatorPublicKey)
            .build(),
        ])
        .build();
      const executionDate = jest.now();
      jest.advanceTimersByTime(1_000);
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', 2) // 2 confirmations required
        .with('confirmations', [
          confirmationBuilder().build(),
          confirmationBuilder().build(),
        ]) // 2 confirmations received
        .with('executionDate', new Date(executionDate)) // execution date < now + exit period
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapValidatorsExitInfo({
        chainId: chain.chainId,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingValidatorsExit',
          status: 'REQUEST_PENDING',
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          value: '96000000000000000000', // 3 public keys in the transaction data => 3 validators * 32 eth
          numValidators: 3, // 3 public keys in the transaction data => 3 validators
          rewards: stakes[0].rewards,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should map a native staking validators exit info with ReadyToWithdraw status', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .build();
      const networkStats = networkStatsBuilder()
        .with('estimated_exit_time_seconds', 2)
        .build();
      const stakes = [stakeBuilder().build()];
      const validatorPublicKey = faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength * 2,
      }); // 2 validators
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'requestValidatorsExit')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', '_publicKeys')
            .with('type', 'bytes')
            .with('value', validatorPublicKey)
            .build(),
        ])
        .build();
      const executionDate = jest.now();
      jest.advanceTimersByTime(3_000); // now > execution time + exit period
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', 2) // 2 confirmations required
        .with('confirmations', [
          confirmationBuilder().build(),
          confirmationBuilder().build(),
        ]) // 2 confirmations received
        .with('executionDate', new Date(executionDate))
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapValidatorsExitInfo({
        chainId: chain.chainId,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingValidatorsExit',
          status: 'READY_TO_WITHDRAW',
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          value: '64000000000000000000', // 2 public keys in the transaction data => 2 validators * 32 eth
          numValidators: 2, // 2 public keys in the transaction data => 2 validators
          rewards: stakes[0].rewards,
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );
    });

    it('should fail if the deployment type is not `dedicated`', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .build();
      const networkStats = networkStatsBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const transaction = multisigTransactionBuilder()
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);

      await expect(
        target.mapValidatorsExitInfo({
          chainId: chain.chainId,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });

    it('should fail if the deployment chain is unknown', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'unknown')
        .build();
      const networkStats = networkStatsBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const transaction = multisigTransactionBuilder()
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);

      await expect(
        target.mapValidatorsExitInfo({
          chainId: chain.chainId,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });

    it('should fail if the deployment status is unknown', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('status', 'unknown')
        .build();
      const networkStats = networkStatsBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const transaction = multisigTransactionBuilder()
        .with('dataDecoded', dataDecoded)
        .build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);

      await expect(
        target.mapValidatorsExitInfo({
          chainId: chain.chainId,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });
  });

  describe('mapWithdrawInfo', () => {
    it('should map a native staking withdraw info', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .build();
      const networkStats = networkStatsBuilder().build();
      const validatorPublicKey = faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength * 2,
      }); // 2 validators
      const dataDecoded = dataDecodedBuilder()
        .with('method', 'requestValidatorsExit')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', '_publicKeys')
            .with('type', 'bytes')
            .with('value', validatorPublicKey)
            .build(),
        ])
        .build();
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', 2) // 2 confirmations required
        .with('confirmations', [confirmationBuilder().build()]) // only 1 confirmation
        .with('dataDecoded', dataDecoded)
        .build();
      const stakes = [
        stakeBuilder().with('rewards', '3.25').build(),
        stakeBuilder().with('rewards', '1.25').build(),
        stakeBuilder().with('rewards', '1').build(),
      ];
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapWithdrawInfo({
        chainId: chain.chainId,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingWithdraw',
          value: '64000000000000000000',
          rewards: '5.5', // stakes rewards sum
          tokenInfo: {
            address: NULL_ADDRESS,
            decimals: chain.nativeCurrency.decimals,
            logoUri: chain.nativeCurrency.logoUri,
            name: chain.nativeCurrency.name,
            symbol: chain.nativeCurrency.symbol,
            trusted: true,
          },
        }),
      );

      expect(mockStakingRepository.getStakes).toHaveBeenCalledWith({
        chainId: chain.chainId,
        validatorsPublicKeys: `${validatorPublicKey.slice(2, KilnDecoder.KilnPublicKeyLength + 2)},${validatorPublicKey.slice(KilnDecoder.KilnPublicKeyLength + 2)}`,
      });
    });

    it('should fail if the deployment type is not `dedicated`', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'defi')
        .build();
      const networkStats = networkStatsBuilder().build();
      const transaction = multisigTransactionBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);

      await expect(
        target.mapWithdrawInfo({
          chainId: chain.chainId,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });

    it('should fail if the deployment chain is unknown', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('chain', 'unknown')
        .build();
      const networkStats = networkStatsBuilder().build();
      const transaction = multisigTransactionBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);

      await expect(
        target.mapWithdrawInfo({
          chainId: chain.chainId,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });

    it('should fail if the deployment status is unknown', async () => {
      const chain = chainBuilder().build();
      const deployment = deploymentBuilder()
        .with('product_type', 'dedicated')
        .with('status', 'unknown')
        .build();
      const networkStats = networkStatsBuilder().build();
      const transaction = multisigTransactionBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);

      await expect(
        target.mapWithdrawInfo({
          chainId: chain.chainId,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });
  });
});
