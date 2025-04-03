import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/routes/transactions/helpers/transaction-finder.helper';
import { Injectable, Module } from '@nestjs/common';
import { getAbiItem, parseAbi, toFunctionSelector } from 'viem';

export const KilnVaultAbi = parseAbi([
  'function deposit(uint256 assets, address receiver)',
  'function approve(address spender, uint256 value)',
]);

@Injectable()
export class KilnVaultHelper {
  private static readonly VAULT_DEPOSIT_SIGNATURE = getAbiItem({
    abi: KilnVaultAbi,
    name: 'deposit',
  });

  constructor(private readonly transactionFinder: TransactionFinder) {}

  public findDepositTransaction(args: {
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
