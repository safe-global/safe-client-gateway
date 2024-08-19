import {
  BlockchainApiManagerModule,
  IBlockchainApiManager,
} from '@/domain/interfaces/blockchain-api.manager.interface';
import { Erc4626Decoder } from '@/domain/staking/contracts/decoders/erc-4626-decoder.helper';
import { IStakingRepository } from '@/domain/staking/staking.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { erc4626Abi } from 'viem';

@Injectable()
export class KilnDefiVaultHelper {
  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    private readonly erc4626Decoder: Erc4626Decoder,
    private readonly transactionFinder: TransactionFinder,
    @Inject(IStakingRepository)
    private readonly stakingRepository: IStakingRepository,
  ) {}

  public async findDeposit(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => this.erc4626Decoder.helpers.isDeposit(transaction.data),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (deployment?.product_type !== 'defi') {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  public async findWithdraw(args: {
    chainId: string;
    to?: `0x${string}`;
    data: `0x${string}`;
  }): Promise<{
    to: `0x${string}`;
    data: `0x${string}`;
  } | null> {
    const transaction = this.transactionFinder.findTransaction(
      (transaction) => this.erc4626Decoder.helpers.isWithdraw(transaction.data),
      args,
    );

    if (!transaction?.to) {
      return null;
    }

    const deployment = await this.stakingRepository
      .getDeployment({
        chainId: args.chainId,
        address: transaction.to,
      })
      .catch(() => null);

    if (deployment?.product_type !== 'defi') {
      return null;
    }

    return {
      to: transaction.to,
      data: transaction.data,
    };
  }

  public decodeDeposit(
    data: `0x${string}`,
  ): [assets: bigint, vault: `0x${string}`] {
    const decoded = this.erc4626Decoder.decodeFunctionData({
      data,
    });

    if (decoded.functionName !== 'deposit') {
      throw new Error('Could not decode deposit amount');
    }

    return [decoded.args[0], decoded.args[1]];
  }

  public async previewDeposit(args: {
    chainId: string;
    vault: `0x${string}`;
    amount: bigint;
  }): Promise<bigint> {
    const blockchainApi = await this.blockchainApiManager.getApi(args.chainId);
    // TODO: Should we cache this?
    // `previewDeposit` returns the best estimate according to the current block
    // if we want to cache this value, we should call `toShares` instead
    return blockchainApi.readContract({
      abi: erc4626Abi,
      functionName: 'previewDeposit',
      address: args.vault,
      args: [args.amount],
    });
  }

  public decodeWithdraw(
    data: `0x${string}`,
  ): [assets: bigint, receiver: `0x${string}`, owner: `0x${string}`] {
    const decoded = this.erc4626Decoder.decodeFunctionData({
      data,
    });

    if (decoded.functionName !== 'withdraw') {
      throw new Error('Could not decode withdraw amount');
    }

    return [decoded.args[0], decoded.args[1], decoded.args[2]];
  }

  public async previewWithdraw(args: {
    chainId: string;
    vault: `0x${string}`;
    amount: bigint;
  }): Promise<bigint> {
    const blockchainApi = await this.blockchainApiManager.getApi(args.chainId);
    // TODO: Should we cache this?
    // `previewWithdraw` returns the best estimate according to the current block
    // if we want to cache this value, we should call `toAssets` instead
    return blockchainApi.readContract({
      abi: erc4626Abi,
      functionName: 'previewWithdraw',
      address: args.vault,
      args: [args.amount],
    });
  }
}

@Module({
  imports: [
    BlockchainApiManagerModule,
    TransactionFinderModule,
    StakingRepositoryModule,
  ],
  providers: [KilnDefiVaultHelper, Erc4626Decoder],
  exports: [KilnDefiVaultHelper],
})
export class KilnDefiVaultHelperModule {}
