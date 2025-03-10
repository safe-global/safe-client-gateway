import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { StakeState } from '@/datasources/staking-api/entities/stake.entity';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';
import { getNumberString } from '@/domain/common/utils/utils';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';
import {
  KilnNativeStakingHelper,
  KilnNativeStakingHelperModule,
} from '@/routes/transactions/helpers/kiln-native-staking.helper';

@Injectable()
export class NativeStakingMapper {
  private static readonly ETH_ETHERS_PER_VALIDATOR = 32;

  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
    private readonly kilnDecoder: KilnDecoder,
    private readonly kilnNativeStakingHelper: KilnNativeStakingHelper,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Maps the {@link NativeStakingDepositTransactionInfo} for the given
   * native staking deployment's `deposit` call
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.to - the address of the native staking deployment
   * @param args.value - the value of the deposit transaction
   * @param args.txHash - the transaction hash of the deposit transaction
   *
   * @returns {@link NativeStakingDepositTransactionInfo} for the given native staking deployment
   */
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string | null;
    txHash: `0x${string}` | null;
  }): Promise<NativeStakingDepositTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);
    this.validateDeployment(deployment);

    const [publicKeys, nativeStakingStats, networkStats] = await Promise.all([
      this.getDepositPublicKeys(args),
      this.stakingRepository.getDedicatedStakingStats(args.chainId),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);
    const status = await this._getStatus({
      chainId: args.chainId,
      safeAddress: args.to,
      publicKeys,
    });

    const value = args.value ? Number(args.value) : 0;
    const numValidators = Math.floor(
      value /
        Math.pow(10, chain.nativeCurrency.decimals) /
        NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR,
    );
    const fee = deployment.product_fee ? Number(deployment.product_fee) : 0;
    // NRR = GRR * (1 - service_fees)
    // Kiln also uses last_30d field, with product_fee
    const nrr = nativeStakingStats.gross_apy.last_30d * (1 - fee);
    const expectedAnnualReward = (nrr / 100) * value;
    const expectedMonthlyReward = expectedAnnualReward / 12;
    const expectedFiatAnnualReward =
      (expectedAnnualReward * (networkStats.eth_price_usd ?? 0)) /
      Math.pow(10, chain.nativeCurrency.decimals);
    const expectedFiatMonthlyReward = expectedFiatAnnualReward / 12;

    return new NativeStakingDepositTransactionInfo({
      status,
      estimatedEntryTime: networkStats.estimated_entry_time_seconds * 1_000,
      estimatedExitTime: networkStats.estimated_exit_time_seconds * 1_000,
      estimatedWithdrawalTime:
        networkStats.estimated_withdrawal_time_seconds * 1_000,
      fee,
      monthlyNrr: nrr / 12,
      annualNrr: nrr,
      value: getNumberString(value),
      numValidators,
      expectedAnnualReward: getNumberString(expectedAnnualReward),
      expectedMonthlyReward: getNumberString(expectedMonthlyReward),
      expectedFiatAnnualReward,
      expectedFiatMonthlyReward,
      // tokenInfo is set to the native currency of the chain for native staking deposits
      tokenInfo: new TokenInfo({
        address: NULL_ADDRESS,
        decimals: chain.nativeCurrency.decimals,
        logoUri: chain.nativeCurrency.logoUri,
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        trusted: true,
      }),
      validators: publicKeys,
    });
  }

  /**
   * Gets the validator public keys from logs of `deposit` transaction.
   *
   * @param args.txHash - the transaction hash of the deposit transaction
   * @param args.chainId - the chain ID of the native staking deployment
   *
   * @returns {Array<`0x${string}`> | null} the public keys of the validators
   */
  private async getDepositPublicKeys(args: {
    txHash: `0x${string}` | null;
    chainId: string;
  }): Promise<Array<`0x${string}`> | null> {
    if (!args.txHash) {
      return null;
    }

    const txStatus = await this.stakingRepository.getTransactionStatus({
      chainId: args.chainId,
      txHash: args.txHash,
    });

    const depositEvents = txStatus.receipt.logs
      .map((log) => this.kilnDecoder.decodeDepositEvent(log))
      .filter(<T>(event: T | null): event is T => event !== null);

    if (depositEvents.length === 0) {
      return [];
    }

    if (depositEvents.length > 1) {
      // This should theoretically never happen but we warn just in case
      this.loggingService.warn('Multiple DepositEvents found in transaction');
    }

    return this.kilnNativeStakingHelper.splitPublicKeys(
      depositEvents[0].pubkey,
    );
  }

  /**
   * Maps the {@link NativeStakingValidatorsExitTransactionInfo} for the given
   * native staking `requestValidatorsExit` transaction.
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.safeAddress - the Safe staking
   * @param args.to - the address of the native staking deployment
   * @param args.data - the data of the `requestValidatorsExit` transaction
   * @returns {@link NativeStakingValidatorsExitTransactionInfo} for the given native staking deployment
   */
  public async mapValidatorsExitInfo(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to: `0x${string}`;
    data: `0x${string}`;
  }): Promise<NativeStakingValidatorsExitTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);
    this.validateDeployment(deployment);
    const publicKeys = this.kilnNativeStakingHelper.splitPublicKeys(
      this.kilnDecoder.decodeValidatorsExit(args.data)!,
    );

    const value =
      publicKeys.length *
      NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR *
      Math.pow(10, chain.nativeCurrency.decimals);
    const [status, networkStats] = await Promise.all([
      this._getStatus({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        publicKeys,
      }),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);
    const numValidators = publicKeys.length;
    return new NativeStakingValidatorsExitTransactionInfo({
      status,
      estimatedExitTime: networkStats.estimated_exit_time_seconds * 1_000,
      estimatedWithdrawalTime:
        networkStats.estimated_withdrawal_time_seconds * 1_000,
      value: getNumberString(value),
      numValidators,
      tokenInfo: new TokenInfo({
        address: NULL_ADDRESS,
        decimals: chain.nativeCurrency.decimals,
        logoUri: chain.nativeCurrency.logoUri,
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        trusted: true,
      }),
      validators: publicKeys,
    });
  }

  /**
   * Maps the {@link NativeStakingWithdrawTransactionInfo} for the given
   * native staking `batchWithdrawCLFee` transaction.
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.safeAddress - the Safe staking
   * @param args.to - the address of the native staking deployment
   * @param args.transaction - the transaction object for the withdraw
   * @param args.txHash - the transaction hash of the withdraw transaction
   * @param args.data - the data of the `batchWithdrawCLFee` transaction
   * @returns {@link NativeStakingWithdrawTransactionInfo} for the given native staking deployment
   */
  public async mapWithdrawInfo(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to: `0x${string}`;
    txHash: `0x${string}` | null;
    data: `0x${string}`;
  }): Promise<NativeStakingWithdrawTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);
    this.validateDeployment(deployment);

    const publicKeys = this.kilnNativeStakingHelper.splitPublicKeys(
      this.kilnDecoder.decodeBatchWithdrawCLFee(args.data)!,
    );
    const value = await this.getWithdrawValue({
      txHash: args.txHash,
      publicKeys: publicKeys,
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });

    return new NativeStakingWithdrawTransactionInfo({
      value: getNumberString(value),
      tokenInfo: new TokenInfo({
        address: NULL_ADDRESS,
        decimals: chain.nativeCurrency.decimals,
        logoUri: chain.nativeCurrency.logoUri,
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        trusted: true,
      }),
      validators: publicKeys,
    });
  }

  /**
   * Dynamically returns the value to withdraw or withdrawn based on whether
   * the batchWithdrawCLFee transaction was executed or not. This is done to
   * cater for Kiln's API.
   *
   * Before execution the API returns current `net_claimable_consensus_rewards`
   * and after execution it returns 0. Therefore, if the transaction was executed
   * we return the value get the exact value from the transaction logs instead.
   *
   * @param {string | nulle} args.txHash - the transaction hash of the withdraw transaction
   * @param {Array<`0x${string}`>} args.publicKeys - the public keys to get the value for
   * @param {string} args.chainId - the chain ID of the native staking deployment
   * @param {string} args.safeAddress - the Safe staking
   *
   * @returns {number} the value to withdraw or withdrawn
   */
  private async getWithdrawValue(args: {
    txHash: `0x${string}` | null;
    publicKeys: Array<`0x${string}`>;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<number> {
    if (!args.txHash) {
      const stakes = await this.stakingRepository.getStakes({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        validatorsPublicKeys: args.publicKeys,
      });
      return stakes.reduce((acc, stake) => {
        const netValue = stake.net_claimable_consensus_rewards ?? '0';
        return acc + Number(netValue);
      }, 0);
    }

    const txStatus = await this.stakingRepository.getTransactionStatus({
      chainId: args.chainId,
      txHash: args.txHash,
    });

    const value = txStatus.receipt.logs
      .map((log) => this.kilnDecoder.decodeWithdrawal(log))
      .reduce((acc, cur) => {
        if (cur === null) {
          return acc;
        }
        return acc + cur.rewards;
      }, BigInt(0));

    return Number(value);
  }

  private validateDeployment(deployment: Deployment): void {
    if (
      deployment.product_type !== 'dedicated' ||
      deployment.chain === 'unknown' ||
      deployment.status === 'unknown'
    ) {
      throw new NotFoundException('Native staking deployment not found');
    }
  }

  /**
   * Gets the status of given {@link publicKeys} from the returned {@link Stake}s.
   *
   * If not {@link publicKeys} are provided, or no {@link Stake}s found, then
   * {@link StakingStatus.NotStaked} is returned.
   *
   * If there are multiple {@link Stake}s, then the status is determined by the
   * earliest {@link StakeState} according to the staking process.
   *
   * @param {string} args.chainId - the chain ID of the native staking deployment
   * @param {string} args.safeAddress - the Safe staking
   * @param {Array<string> | null} args.publicKeys - the public keys to get the status for
   *
   * @returns {Promise<StakingStatus>} the status of the given {@link publicKeys}
   *
   * Note: this is only public for testing purposes.
   */
  public async _getStatus(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    publicKeys: Array<`0x${string}`> | null;
  }): Promise<StakingStatus> {
    if (!args.publicKeys || args.publicKeys.length === 0) {
      return StakingStatus.NotStaked;
    }

    const stakes = await this.stakingRepository.getStakes({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      validatorsPublicKeys: args.publicKeys,
    });

    if (stakes.length === 0) {
      return StakingStatus.NotStaked;
    }

    /**
     * As there can be multiple {@link State}s but we return a singular status
     * we get the "overall" status based on the "earliest" state according to
     * the ordered staking process.
     */
    const OrderedStakingStates = [
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
    ];

    const [stake] = stakes.sort((a, b) => {
      return (
        OrderedStakingStates.indexOf(a.state) -
        OrderedStakingStates.indexOf(b.state)
      );
    });

    /**
     * Certain {@link StakeState}s, fall under the same {@link StakingStatus}
     * as they are inherently the same for the UI.
     *
     * @see https://github.com/kilnfi/staking-dapp/blob/343ca9c2313676c6a31d6fef6aa5fd9cd4e03278/services/apps/ledger-live-app/types/eth.ts#L23-L97
     */
    //
    switch (stake.state) {
      // Validation key generated but not staked
      case StakeState.Unknown:
      case StakeState.Unstaked: {
        return StakingStatus.NotStaked;
      }
      // Validator in chain activation queue
      case StakeState.PendingQueued: {
        return StakingStatus.Activating;
      }
      // Validator staked and will be processed by chain soon
      case StakeState.DepositInProgress:
      case StakeState.PendingInitialized: {
        return StakingStatus.DepositInProgress;
      }
      // Validator online and collecting rewards
      case StakeState.ActiveOngoing: {
        return StakingStatus.Active;
      }
      // Requested to exit validator
      case StakeState.ExitRequested: {
        return StakingStatus.ExitRequested;
      }
      // Validator in process of leaving validator pool and being withdrawn
      case StakeState.ActiveExiting:
      case StakeState.ExitedUnslashed:
      case StakeState.WithdrawalPossible: {
        return StakingStatus.Exiting;
      }
      // Validator properly exited and no longer collecting rewards
      case StakeState.WithdrawalDone: {
        return StakingStatus.Exited;
      }
      // Validator slashed because it signed wrong attestations or proposed incorrect block
      // Note: it is no longer collecting rewards
      case StakeState.ActiveSlashed:
      case StakeState.ExitedSlashed: {
        return StakingStatus.Slashed;
      }
    }
  }
}

@Module({
  imports: [
    StakingRepositoryModule,
    ChainsRepositoryModule,
    KilnNativeStakingHelperModule,
  ],
  providers: [NativeStakingMapper, KilnDecoder],
  exports: [NativeStakingMapper],
})
export class NativeStakingMapperModule {}
