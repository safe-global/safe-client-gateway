import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import {
  KilnAbi,
  KilnDecoder,
} from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import {
  Inject,
  Injectable,
  Module,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AbiFunction, getAbiItem, isHex, toFunctionSelector } from 'viem';

@Injectable()
export class KilnNativeStakingHelper {
  private static readonly DEPOSIT_SIGNATURE = getAbiItem({
    abi: KilnAbi,
    name: 'deposit',
  });
  private static readonly VALIDATORS_EXIT_SIGNATURE = getAbiItem({
    abi: KilnAbi,
    name: 'requestValidatorsExit',
  });
  private static readonly WITHDRAW_SIGNATURE = getAbiItem({
    abi: KilnAbi,
    name: 'batchWithdrawCLFee',
  });

  constructor(
    private readonly transactionFinder: TransactionFinder,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

  public async findDepositTransaction(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    return this.findNativeStakingTransaction({
      item: KilnNativeStakingHelper.DEPOSIT_SIGNATURE,
      ...args,
    });
  }

  public async findValidatorsExitTransaction(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    return this.findNativeStakingTransaction({
      item: KilnNativeStakingHelper.VALIDATORS_EXIT_SIGNATURE,
      ...args,
    });
  }

  public async findWithdrawTransaction(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    return this.findNativeStakingTransaction({
      item: KilnNativeStakingHelper.WITHDRAW_SIGNATURE,
      ...args,
    });
  }

  private async findNativeStakingTransaction(args: {
    item: AbiFunction;
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    const transaction = this.transactionFinder.findTransaction(
      (transaction) =>
        transaction.data.startsWith(toFunctionSelector(args.item)),
      args,
    );

    if (!transaction?.to) {
      return null;
    }
    return this.checkDeployment({
      chainId: args.chainId,
      transaction: { to: transaction.to, data: transaction.data },
    });
  }

  /**
   * Check the deployment to see if it is a valid staking transaction.
   * We need to check against the deployment as some function signatures have common function names, e.g. deposit.
   */
  private async checkDeployment(args: {
    chainId: string;
    transaction: { to: `0x${string}`; data: `0x${string}` };
  }): Promise<{ to: `0x${string}`; data: `0x${string}` } | null> {
    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: args.transaction.to,
      })
      .catch(() => null);

    if (
      deployment?.product_type !== 'dedicated' ||
      deployment?.chain === 'unknown'
    ) {
      return null;
    }

    return {
      to: args.transaction.to,
      data: args.transaction.data,
    };
  }

  /**
   * Gets the net value (staked + rewards) to withdraw from the native staking deployment
   * based on the length of the publicKeys field in the transaction data.
   *
   * Note: this can only be used with `validatorsExit` or `batchWithdrawCLFee` transactions
   * as the have `_publicKeys` field in the decoded data.
   *
   * Each {@link KilnDecoder.KilnPublicKeyLength} characters represent a validator to withdraw,
   * and each native staking validator has a fixed amount of 32 ETH to withdraw.
   *
   * @param dataDecoded - the decoded data of the transaction
   * @param chainId - the ID of the chain where the native staking deployment lives
   * @param safeAddress - the Safe staking
   * @returns the net value to withdraw from the native staking deployment
   */
  public async getValueFromDataDecoded(args: {
    chainId: string;
    safeAddress: `0x${string}`;
    dataDecoded: DataDecoded;
  }): Promise<number> {
    const publicKeys = this.getPublicKeysFromDataDecoded(args.dataDecoded);
    if (publicKeys.length === 0) {
      return 0;
    }
    const stakes = await this.stakingRepository.getStakes({
      chainId: args.chainId,
      safeAddress: args.safeAddress,
      validatorsPublicKeys: publicKeys,
    });
    return stakes.reduce((acc, stake) => {
      const netValue = stake.net_claimable_consensus_rewards ?? '0';
      return acc + Number(netValue);
    }, 0);
  }

  /**
   * Gets public keys from decoded `requestValidatorsExit` or `batchWithdrawCLFee` transactions
   * @param dataDecoded - the transaction decoded data.
   * @returns the public keys from the transaction decoded data.
   */
  public getPublicKeysFromDataDecoded(
    dataDecoded: DataDecoded,
  ): Array<`0x${string}`> {
    if (
      !['requestValidatorsExit', 'batchWithdrawCLFee'].includes(
        dataDecoded.method,
      )
    ) {
      throw new UnprocessableEntityException(
        `${dataDecoded.method} does not contain _publicKeys`,
      );
    }

    const publicKeys = dataDecoded.parameters?.find((parameter) => {
      return parameter.name === '_publicKeys';
    });
    return isHex(publicKeys?.value)
      ? this.splitPublicKeys(publicKeys.value)
      : [];
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
  public splitPublicKeys(publicKeys: `0x${string}`): `0x${string}`[] {
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
  imports: [TransactionFinderModule, StakingRepositoryModule],
  providers: [KilnNativeStakingHelper, KilnDecoder],
  exports: [KilnNativeStakingHelper, KilnDecoder],
})
export class KilnNativeStakingHelperModule {}
