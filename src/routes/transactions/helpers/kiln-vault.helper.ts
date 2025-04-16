import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Injectable, Module } from '@nestjs/common';
import {
  decodeFunctionData,
  getAbiItem,
  parseAbi,
  toFunctionSelector,
} from 'viem';

export const KilnVaultAbi = parseAbi([
  'function deposit(uint256 assets, address receiver)',
]);

@Injectable()
export class KilnVaultHelper {
  private static readonly VAULT_DEPOSIT_SIGNATURE = getAbiItem({
    abi: KilnVaultAbi,
    name: 'deposit',
  });

  constructor(private readonly transactionFinder: TransactionFinder) {}

  public getVaultDepositTransaction(args: {
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): {
    to?: `0x${string}`;
    data: `0x${string}`;
    assets: number;
  } | null {
    const transaction = this.findVaultDepositTransaction(args);
    if (!transaction) {
      return null;
    }

    const decoded = decodeFunctionData({
      abi: KilnVaultAbi,
      data: transaction.data,
    });

    return {
      to: transaction.to,
      data: transaction.data,
      assets: Number(decoded.args[0]),
    };
  }

  private findVaultDepositTransaction(args: {
    to?: `0x${string}`;
    data: `0x${string}`;
    value: string;
  }): { to?: `0x${string}`; data: `0x${string}`; value: string } | null {
    const selector = toFunctionSelector(
      KilnVaultHelper.VAULT_DEPOSIT_SIGNATURE,
    );
    return this.transactionFinder.findTransaction(
      (transaction) => transaction.data.startsWith(selector),
      args,
    );
  }
}

@Module({
  imports: [TransactionFinderModule],
  providers: [KilnVaultHelper, KilnDecoder],
  exports: [KilnVaultHelper, KilnDecoder],
})
export class KilnVaultHelperModule {}
