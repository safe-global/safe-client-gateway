import {
  BlockchainApiManagerModule,
  IBlockchainApiManager,
} from '@/domain/interfaces/blockchain-api.manager.interface';
import { Erc4626Decoder } from '@/domain/staking/contracts/decoders/erc-4626-decoder.helper';
import {
  TransactionDataFinder,
  TransactionDataFinderModule,
} from '@/routes/transactions/helpers/transaction-data-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { erc4626Abi } from 'viem';

@Injectable()
export class KilnDefiVaultHelper {
  constructor(
    @Inject(IBlockchainApiManager)
    private readonly blockchainApiManager: IBlockchainApiManager,
    private readonly erc4626Decoder: Erc4626Decoder,
    private readonly transactionDataFinder: TransactionDataFinder,
  ) {}

  public findDeposit(data: `0x${string}`): `0x${string}` | null {
    return this.transactionDataFinder.findTransactionData(
      (transaction) => this.erc4626Decoder.helpers.isDeposit(transaction.data),
      { data },
    );
  }

  public findWithdraw(data: `0x${string}`): `0x${string}` | null {
    return this.transactionDataFinder.findTransactionData(
      (transaction) => this.erc4626Decoder.helpers.isWithdraw(transaction.data),
      { data },
    );
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
  imports: [BlockchainApiManagerModule, TransactionDataFinderModule],
  providers: [KilnDefiVaultHelper, Erc4626Decoder],
  exports: [KilnDefiVaultHelper],
})
export class KilnDefiVaultHelperModule {}
