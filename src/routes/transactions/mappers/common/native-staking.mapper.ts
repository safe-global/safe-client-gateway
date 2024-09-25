import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { StakeState } from '@/datasources/staking-api/entities/stake.entity';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';
import { getNumberString } from '@/domain/common/utils/utils';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';
import { StakingStatus } from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';
import { isHex } from 'viem';

@Injectable()
export class NativeStakingMapper {
  private static readonly ETH_ETHERS_PER_VALIDATOR = 32;

  constructor(
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
    @Inject(IChainsRepository)
    private readonly chainsRepository: IChainsRepository,
  ) {}

  /**
   * Maps the {@link NativeStakingDepositTransactionInfo} for the given
   * native staking deployment's `deposit` call
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.to - the address of the native staking deployment
   * @param args.value - the value of the deposit transaction
   * @param args.isConfirmed - whether the deposit transaction is confirmed
   * @param args.depositExecutionDate - the date when the deposit transaction was executed
   *
   * @returns {@link NativeStakingDepositTransactionInfo} for the given native staking deployment
   */
  public async mapDepositInfo(args: {
    chainId: string;
    to: `0x${string}`;
    value: string | null;
    isConfirmed: boolean;
    depositExecutionDate: Date | null;
  }): Promise<NativeStakingDepositTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);
    this.validateDeployment(deployment);

    const [status, nativeStakingStats, networkStats] = await Promise.all([
      this._getStatus({
        chainId: args.chainId,
        safeAddress: args.to,
        publicKeys: [],
      }),
      this.stakingRepository.getDedicatedStakingStats(args.chainId),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);

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
      estimatedEntryTime: networkStats.estimated_entry_time_seconds,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
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
    });
  }

  /**
   * Maps the {@link NativeStakingValidatorsExitTransactionInfo} for the given
   * native staking `requestValidatorsExit` transaction.
   *
   * @param args.chainId - the chain ID of the native staking deployment
   * @param args.safeAddress - the Safe staking
   * @param args.to - the address of the native staking deployment
   * @param args.transaction - the transaction object for the validators exit
   * @param args.dataDecoded - the decoded data of the transaction
   * @returns {@link NativeStakingValidatorsExitTransactionInfo} for the given native staking deployment
   */
  public async mapValidatorsExitInfo(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to: `0x${string}`;
    transaction: MultisigTransaction | ModuleTransaction | null;
    dataDecoded: DataDecoded;
  }): Promise<NativeStakingValidatorsExitTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);
    this.validateDeployment(deployment);
    const _publicKeys = this.getPublicKeysFromDataDecoded(args.dataDecoded);
    const publicKeys = _publicKeys ? this.splitPublicKeys(_publicKeys) : [];

    const [status, networkStats] = await Promise.all([
      this._getStatus({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        publicKeys,
      }),
      this.stakingRepository.getNetworkStats(args.chainId),
    ]);
    const numValidators = this.getNumValidatorsFromDataDecoded(
      args.dataDecoded,
    );
    // We don't include this in Promise.all as getStatus may cache Stakes to be reused
    const value = await this.getValueFromDataDecoded({
      dataDecoded: args.dataDecoded,
      chainId: args.chainId,
      safeAddress: args.safeAddress,
    });
    return new NativeStakingValidatorsExitTransactionInfo({
      status,
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
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
   * @param args.dataDecoded - the decoded data of the transaction
   * @returns {@link NativeStakingWithdrawTransactionInfo} for the given native staking deployment
   */
  public async mapWithdrawInfo(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    to: `0x${string}`;
    transaction: MultisigTransaction | ModuleTransaction | null;
    dataDecoded: DataDecoded;
  }): Promise<NativeStakingWithdrawTransactionInfo> {
    const [chain, deployment] = await Promise.all([
      this.chainsRepository.getChain(args.chainId),
      this.stakingRepository.getDeployment({
        chainId: args.chainId,
        address: args.to,
      }),
    ]);
    this.validateDeployment(deployment);
    const value = await this.getValueFromDataDecoded({
      dataDecoded: args.dataDecoded,
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
    });
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
   * @param {Array<string>} args.publicKeys - the public keys to get the status for
   *
   * @returns {Promise<StakingStatus>} the status of the given {@link publicKeys}
   *
   * Note: this is only public for testing purposes.
   */
  public async _getStatus(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    publicKeys: Array<`0x${string}`>;
  }): Promise<StakingStatus> {
    if (args.publicKeys.length === 0) {
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

  /**
   * Gets the net value (staked + rewards) to withdraw from the native staking deployment
   * based on the length of the publicKeys field in the transaction data.
   *
   * Each {@link KilnDecoder.KilnPublicKeyLength} characters represent a validator to withdraw,
   * and each native staking validator has a fixed amount of 32 ETH to withdraw.
   *
   * @param dataDecoded - the decoded data of the transaction
   * @param chainId - the ID of the chain where the native staking deployment lives
   * @param safeAddress - the Safe staking
   * @returns the net value to withdraw from the native staking deployment
   */
  private async getValueFromDataDecoded(args: {
    dataDecoded: DataDecoded;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<number> {
    const publicKeys = this.getPublicKeysFromDataDecoded(args.dataDecoded);
    if (!publicKeys) {
      return 0;
    }
    const stakes = await this.stakingRepository.getStakes({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      validatorsPublicKeys: this.splitPublicKeys(publicKeys),
    });
    return stakes.reduce((acc, stake) => {
      const netValue = stake.net_claimable_consensus_rewards ?? '0';
      return acc + Number(netValue);
    }, 0);
  }

  /**
   * Gets the public keys from the transaction decoded data.
   * @param data - the transaction decoded data.
   * @returns the public keys from the transaction decoded data.
   */
  private getPublicKeysFromDataDecoded(
    data: DataDecoded,
  ): `0x${string}` | null {
    const publicKeys = data.parameters?.find(
      (parameter) => parameter.name === '_publicKeys',
    );
    return isHex(publicKeys?.value) ? publicKeys.value : null;
  }

  private getNumValidatorsFromDataDecoded(data: DataDecoded): number {
    const publicKeys = this.getPublicKeysFromDataDecoded(data);
    if (!publicKeys) {
      return 0;
    }
    return Math.floor(
      // Ignore the `0x` prefix
      (publicKeys.length - 2) / KilnDecoder.KilnPublicKeyLength,
    );
  }

  /**
   * Splits the public keys into an array of public keys.
   *
   * Each {@link KilnDecoder.KilnPublicKeyLength} characters represent a validator to withdraw, so the public keys
   * are split into an array of strings of length {@link KilnDecoder.KilnPublicKeyLength}.
   *
   * @param publicKeys - the public keys to split
   * @returns
   */
  private splitPublicKeys(publicKeys: `0x${string}`): `0x${string}`[] {
    // Remove initial `0x` of decoded `_publicKeys`
    const publicKeysString = publicKeys.slice(2);
    const publicKeysArray: `0x${string}`[] = [];
    for (
      let i = 0;
      i < publicKeysString.length;
      i += KilnDecoder.KilnPublicKeyLength
    ) {
      publicKeysArray.push(
        `0x${publicKeysString.slice(i, i + KilnDecoder.KilnPublicKeyLength)}`,
      );
    }
    return publicKeysArray;
  }
}

@Module({
  imports: [StakingRepositoryModule, ChainsRepositoryModule],
  providers: [NativeStakingMapper],
  exports: [NativeStakingMapper],
})
export class NativeStakingMapperModule {}
