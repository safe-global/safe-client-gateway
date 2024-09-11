import { Deployment } from '@/datasources/staking-api/entities/deployment.entity';
import { NetworkStats } from '@/datasources/staking-api/entities/network-stats.entity';
import {
  ChainsRepositoryModule,
  IChainsRepository,
} from '@/domain/chains/chains.repository.interface';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { STAKING_PUBLIC_KEY_LENGTH } from '@/domain/staking/constants';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { NativeStakingDepositTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-deposit-info.entity';
import { NativeStakingValidatorsExitTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-validators-exit-info.entity';
import { NativeStakingWithdrawTransactionInfo } from '@/routes/transactions/entities/staking/native-staking-withdraw-info.entity';
import {
  StakingDepositStatus,
  StakingValidatorsExitStatus,
} from '@/routes/transactions/entities/staking/staking.entity';
import { TokenInfo } from '@/routes/transactions/entities/swaps/token-info.entity';
import { Inject, Injectable, Module, NotFoundException } from '@nestjs/common';

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

    const [nativeStakingStats, networkStats] = await Promise.all([
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
      status: this.mapDepositStatus(
        networkStats,
        args.isConfirmed,
        args.depositExecutionDate,
      ),
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
   * @param args.to - the address of the native staking deployment
   * @param args.transaction - the transaction object for the validators exit
   * @param args.dataDecoded - the decoded data of the transaction
   * @returns {@link NativeStakingValidatorsExitTransactionInfo} for the given native staking deployment
   */
  public async mapValidatorsExitInfo(args: {
    chainId: string;
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
    const networkStats = await this.stakingRepository.getNetworkStats(
      args.chainId,
    );
    const numValidators = this.getNumValidatorsFromDataDecoded(
      args.dataDecoded,
    );
    const value = this.getValueFromNumValidators(numValidators, chain);
    const rewards = await this.getRewardsFromDataDecoded(
      args.dataDecoded,
      chain,
    );

    return new NativeStakingValidatorsExitTransactionInfo({
      status: this.mapValidatorsExitStatus(networkStats, args.transaction),
      estimatedExitTime: networkStats.estimated_exit_time_seconds,
      estimatedWithdrawalTime: networkStats.estimated_withdrawal_time_seconds,
      value: getNumberString(value),
      numValidators,
      rewards: getNumberString(rewards),
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
   * @param args.to - the address of the native staking deployment
   * @param args.transaction - the transaction object for the withdraw
   * @param args.dataDecoded - the decoded data of the transaction
   * @returns {@link NativeStakingWithdrawTransactionInfo} for the given native staking deployment
   */
  public async mapWithdrawInfo(args: {
    chainId: string;
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
    const numValidators = this.getNumValidatorsFromDataDecoded(
      args.dataDecoded,
    );
    const value = this.getValueFromNumValidators(numValidators, chain);
    const rewards = await this.getRewardsFromDataDecoded(
      args.dataDecoded,
      chain,
    );

    return new NativeStakingWithdrawTransactionInfo({
      value: getNumberString(value),
      rewards: getNumberString(rewards),
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
   * Maps the {@link StakingDepositStatus} for the given native staking deployment's `deposit` call.
   * - If the deposit transaction is not confirmed, the status is {@link StakingDepositStatus.SignatureNeeded}.
   * - If the deposit transaction is confirmed but the deposit execution date is not available,
   * the status is {@link StakingDepositStatus.AwaitingExecution}.
   * - If the deposit execution date is available, the status is {@link StakingDepositStatus.AwaitingEntry} if the current
   * date is before the estimated entry time, otherwise the status is {@link StakingDepositStatus.ValidationStarted}.
   *
   * @param networkStats - the network stats for the chain where the native staking deployment lives.
   * @param isConfirmed - whether the deposit transaction is confirmed.
   * @param depositExecutionDate - the date when the deposit transaction was executed.
   * @returns - the {@link StakingDepositStatus} status of the deposit transaction.
   */
  private mapDepositStatus(
    networkStats: NetworkStats,
    isConfirmed: boolean,
    depositExecutionDate: Date | null,
  ): StakingDepositStatus {
    if (!isConfirmed) {
      return StakingDepositStatus.SignatureNeeded;
    }

    if (!depositExecutionDate) {
      return StakingDepositStatus.AwaitingExecution;
    }

    const estimatedDepositEntryTime =
      depositExecutionDate.getTime() +
      networkStats.estimated_entry_time_seconds * 1000;

    return Date.now() <= estimatedDepositEntryTime
      ? StakingDepositStatus.AwaitingEntry
      : StakingDepositStatus.ValidationStarted;
  }

  /**
   * Maps the {@link StakingValidatorsExitStatus} for the given native staking `requestValidatorsExit` transaction.
   * - If the transaction is not confirmed, the status is {@link StakingValidatorsExitStatus.SignatureNeeded}.
   * - If the transaction is confirmed but the execution date is not available, the status
   * is {@link StakingValidatorsExitStatus.AwaitingExecution}.
   * - If the execution date is available, the status is {@link StakingValidatorsExitStatus.RequestPending} if the
   * current date is before the estimated exit time, otherwise the status is {@link StakingValidatorsExitStatus.ReadyToWithdraw}.
   *
   * @param networkStats - the network stats for the chain where the native staking deployment lives.
   * @param transaction - the validators exit transaction.
   * @returns - the {@link StakingValidatorsExitStatus} status of the validators exit transaction.
   */
  private mapValidatorsExitStatus(
    networkStats: NetworkStats,
    transaction: MultisigTransaction | ModuleTransaction | null,
  ): StakingValidatorsExitStatus {
    const isConfirmed =
      transaction &&
      'confirmations' in transaction &&
      !!transaction.confirmations &&
      transaction.confirmations.length >= transaction.confirmationsRequired;

    if (!isConfirmed) {
      return StakingValidatorsExitStatus.SignatureNeeded;
    }

    if (!transaction.executionDate) {
      return StakingValidatorsExitStatus.AwaitingExecution;
    }

    const estimatedCompletionTime =
      transaction.executionDate.getTime() +
      networkStats.estimated_exit_time_seconds * 1000;

    return Date.now() <= estimatedCompletionTime
      ? StakingValidatorsExitStatus.RequestPending
      : StakingValidatorsExitStatus.ReadyToWithdraw;
  }

  /**
   * Gets the value staked in the native staking deployment based on the number of validators.
   * Each validator has a fixed amount of 32 ETH staked.
   *
   * @param numValidators - the number of validators
   * @param chain - the chain where the native staking deployment lives
   * @returns - the value staked in the native staking deployment
   */
  private getValueFromNumValidators(
    numValidators: number,
    chain: Chain,
  ): number {
    const decimals = chain.nativeCurrency.decimals;
    return (
      numValidators *
      Math.pow(10, decimals) *
      NativeStakingMapper.ETH_ETHERS_PER_VALIDATOR
    );
  }

  /**
   * Gets the rewards to withdraw from the native staking deployment
   * based on the length of the publicKeys field in the transaction data.
   *
   * Each {@link STAKING_PUBLIC_KEY_LENGTH} characters represent a validator to withdraw,
   * and each native staking validator has a fixed amount of 32 ETH to withdraw.
   *
   * @param data - the decoded data of the transaction
   * @param chain - the chain where the native staking deployment lives
   * @returns the rewards to withdraw from the native staking deployment
   */
  private async getRewardsFromDataDecoded(
    data: DataDecoded,
    chain: Chain,
  ): Promise<number> {
    const publicKeys = this.getPublicKeysFromDataDecoded(data);
    if (!publicKeys) {
      return 0;
    }
    const stakes = await this.stakingRepository.getStakes({
      chainId: chain.chainId,
      validatorsPublicKeys: this.splitPublicKeys(publicKeys).join(','),
    });
    return stakes.reduce((acc, stake) => acc + Number(stake.rewards), 0);
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
    return publicKeys ? (publicKeys.value as `0x${string}`) : null;
  }

  private getNumValidatorsFromDataDecoded(data: DataDecoded): number {
    const publicKeys = this.getPublicKeysFromDataDecoded(data);
    if (!publicKeys) {
      return 0;
    }
    return Math.floor(publicKeys.length / STAKING_PUBLIC_KEY_LENGTH);
  }

  /**
   * Splits the public keys into an array of public keys.
   *
   * Each {@link STAKING_PUBLIC_KEY_LENGTH} characters represent a validator to withdraw, so the public keys
   * are split into an array of strings of length {@link STAKING_PUBLIC_KEY_LENGTH}. The initial `0x` is removed.
   *
   * @param publicKeys - the public keys to split
   * @returns
   */
  private splitPublicKeys(publicKeys: `0x${string}`): string[] {
    const publicKeysString = publicKeys.slice(2);
    const publicKeysArray = [];
    for (
      let i = 0;
      i < publicKeysString.length;
      i += STAKING_PUBLIC_KEY_LENGTH
    ) {
      publicKeysArray.push(
        `${publicKeysString.slice(i, i + STAKING_PUBLIC_KEY_LENGTH)}`,
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
