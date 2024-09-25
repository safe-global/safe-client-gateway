import {
  dedicatedStakingStatsBuilder,
  dedicatedStakingStatsGrossApyBuilder,
} from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';
import {
  transactionStatusBuilder,
  transactionStatusReceiptBuilder,
  transactionStatusReceiptLogBuilder,
} from '@/datasources/staking-api/entities/__tests__/transaction-status.entity.builder';
import { StakeState } from '@/datasources/staking-api/entities/stake.entity';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { depositEventEventBuilder } from '@/domain/staking/contracts/decoders/__tests__/encoders/kiln-encoder.builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { ILoggingService } from '@/logging/logging.interface';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const mockStakingRepository = jest.mocked({
  getDeployment: jest.fn(),
  getDedicatedStakingStats: jest.fn(),
  getNetworkStats: jest.fn(),
  getStakes: jest.fn(),
  getTransactionStatus: jest.fn(),
} as jest.MockedObjectDeep<StakingRepository>);

const mockChainsRepository = jest.mocked({
  getChain: jest.fn(),
} as jest.MockedObjectDeep<ChainsRepository>);

const mockLoggingService = {
  debug: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

// This matches NativeStakingMapper['_getStatus'] but is localized
// to ensure any later changes accordingly break tests
const statusMap: { [key in StakeState]: StakingStatus } = {
  [StakeState.Unknown]: StakingStatus.NotStaked,
  [StakeState.Unstaked]: StakingStatus.NotStaked,
  [StakeState.PendingQueued]: StakingStatus.Activating,
  [StakeState.DepositInProgress]: StakingStatus.DepositInProgress,
  [StakeState.PendingInitialized]: StakingStatus.DepositInProgress,
  [StakeState.ActiveOngoing]: StakingStatus.Active,
  [StakeState.ExitRequested]: StakingStatus.ExitRequested,
  [StakeState.ActiveExiting]: StakingStatus.Exiting,
  [StakeState.ExitedUnslashed]: StakingStatus.Exiting,
  [StakeState.WithdrawalPossible]: StakingStatus.Exiting,
  [StakeState.WithdrawalDone]: StakingStatus.Exited,
  [StakeState.ActiveSlashed]: StakingStatus.Slashed,
  [StakeState.ExitedSlashed]: StakingStatus.Slashed,
};

describe('NativeStakingMapper', () => {
  let target: NativeStakingMapper;

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    const kilnDecoder = new KilnDecoder(mockLoggingService);
    target = new NativeStakingMapper(
      mockStakingRepository,
      mockChainsRepository,
      kilnDecoder,
      mockLoggingService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('mapDepositInfo', () => {
    it('should map a proposed native staking deposit info', async () => {
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
      mockStakingRepository.getStakes.mockResolvedValue([]);

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: deployment.address,
        value: '64000000000000000000',
        transaction: null,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingDeposit',
          status: 'NOT_STAKED',
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

    it('should map a native staking deposit info', async () => {
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
      const stakes = [
        stakeBuilder().with('state', StakeState.DepositInProgress).build(),
      ];
      const depositEventEvent = depositEventEventBuilder().encode();
      const transactionStatus = transactionStatusBuilder()
        .with(
          'receipt',
          transactionStatusReceiptBuilder()
            .with('logs', [
              transactionStatusReceiptLogBuilder()
                .with('data', depositEventEvent.data)
                .with('topics', depositEventEvent.topics)
                .build(),
            ])
            .build(),
        )
        .build();
      const transaction = multisigTransactionBuilder().build();
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getDedicatedStakingStats.mockResolvedValue(
        dedicatedStakingStats,
      );
      mockStakingRepository.getTransactionStatus.mockResolvedValue(
        transactionStatus,
      );
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapDepositInfo({
        chainId: chain.chainId,
        to: deployment.address,
        value: '64000000000000000000',
        transaction,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingDeposit',
          status: 'DEPOSIT_IN_PROGRESS',
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
          transaction: null,
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
          transaction: null,
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
          transaction: null,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });
  });

  describe('mapValidatorsExitInfo', () => {
    it('should map a native staking validators exit info', async () => {
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
        safeAddress: transaction.safe,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingValidatorsExit',
          status: statusMap[stakes[0].state],
          estimatedExitTime: networkStats.estimated_exit_time_seconds,
          estimatedWithdrawalTime:
            networkStats.estimated_withdrawal_time_seconds,
          value: stakes[0].net_claimable_consensus_rewards,
          numValidators: 3, // 3 public keys in the transaction data => 3 validators
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
          safeAddress: transaction.safe,
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
          safeAddress: transaction.safe,
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
          safeAddress: transaction.safe,
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
        stakeBuilder()
          .with('net_claimable_consensus_rewards', '3.25')
          .with('state', StakeState.WithdrawalDone)
          .build(),
        stakeBuilder()
          .with('net_claimable_consensus_rewards', '1.25')
          .with('state', StakeState.WithdrawalDone)
          .build(),
        stakeBuilder()
          .with('net_claimable_consensus_rewards', '1')
          .with('state', StakeState.WithdrawalDone)
          .build(),
      ];
      mockChainsRepository.getChain.mockResolvedValue(chain);
      mockStakingRepository.getDeployment.mockResolvedValue(deployment);
      mockStakingRepository.getNetworkStats.mockResolvedValue(networkStats);
      mockStakingRepository.getStakes.mockResolvedValue(stakes);

      const actual = await target.mapWithdrawInfo({
        chainId: chain.chainId,
        safeAddress: transaction.safe,
        to: deployment.address,
        transaction,
        dataDecoded,
      });

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'NativeStakingWithdraw',
          value: (
            +stakes[0].net_claimable_consensus_rewards! +
            +stakes[1].net_claimable_consensus_rewards! +
            +stakes[2].net_claimable_consensus_rewards!
          ).toString(),
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
        safeAddress: transaction.safe,
        validatorsPublicKeys: [
          `${validatorPublicKey.slice(0, KilnDecoder.KilnPublicKeyLength + 2)}`,
          `0x${validatorPublicKey.slice(KilnDecoder.KilnPublicKeyLength + 2)}`,
        ],
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
          safeAddress: transaction.safe,
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
          safeAddress: transaction.safe,
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
          safeAddress: transaction.safe,
          to: deployment.address,
          transaction,
          dataDecoded,
        }),
      ).rejects.toThrow('Native staking deployment not found');
    });
  });

  describe('_getStatus', () => {
    it('should return NOT_STAKED if there are no public keys', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const publicKeys: Array<`0x${string}`> = [];

      const actual = await target._getStatus({
        chainId,
        safeAddress,
        publicKeys,
      });

      expect(actual).toBe('NOT_STAKED');
    });

    it('should return NOT_STAKED if there are no stakes', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const publicKeys = [getAddress(faker.finance.ethereumAddress())];
      mockStakingRepository.getStakes.mockResolvedValue([]);

      const actual = await target._getStatus({
        chainId,
        safeAddress,
        publicKeys,
      });

      expect(actual).toBe('NOT_STAKED');
    });

    [
      StakeState.Unknown,
      StakeState.Unstaked,
      StakeState.PendingQueued,
      StakeState.DepositInProgress,
      StakeState.PendingInitialized,
      StakeState.ActiveOngoing,
      StakeState.ExitRequested,
      StakeState.ActiveExiting,
      StakeState.ExitedUnslashed,
      StakeState.WithdrawalPossible,
      StakeState.WithdrawalDone,
      StakeState.ActiveSlashed,
      StakeState.ExitedSlashed,
    ].map((state, i, arr) => {
      const nextState = arr[i + 1];

      it(`should return ${statusMap[state]} if ${state} is the earliest state in returned Stakes`, async () => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const publicKeys = [getAddress(faker.finance.ethereumAddress())];
        const stakes = [
          stakeBuilder().with('state', state).build(),
          ...(nextState
            ? [stakeBuilder().with('state', nextState).build()]
            : []),
        ];
        mockStakingRepository.getStakes.mockResolvedValue(stakes);

        const actual = await target._getStatus({
          chainId,
          safeAddress,
          publicKeys,
        });

        expect(actual).toBe(statusMap[state]);
      });
    });
  });
});
