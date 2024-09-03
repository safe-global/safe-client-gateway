import {
  dedicatedStakingStatsBuilder,
  dedicatedStakingStatsGrossApyBuilder,
} from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { StakingRepository } from '@/domain/staking/staking.repository';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';

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

    it('should map a native staking deposit info with RequestPending status', async () => {
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
  });
});
