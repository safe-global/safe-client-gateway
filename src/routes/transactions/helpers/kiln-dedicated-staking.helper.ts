import {
  TransactionDataFinder,
  TransactionDataFinderModule,
} from '@/routes/transactions/helpers/transaction-data-finder.helper';
import { Injectable, Module } from '@nestjs/common';
import { toFunctionSelector } from 'viem';

@Injectable()
export class KilnDedicatedStakingHelper {
  constructor(private readonly transactionDataFinder: TransactionDataFinder) {}

  public findDeposit(data: `0x${string}`): `0x${string}` | null {
    const selector = toFunctionSelector('function deposit() external payable');
    return this.transactionDataFinder.findTransactionData(
      (transaction) => transaction.data.startsWith(selector),
      { data },
    );
  }
}

@Module({
  imports: [TransactionDataFinderModule],
  providers: [KilnDedicatedStakingHelper],
  exports: [KilnDedicatedStakingHelper],
})
export class KilnDedicatedStakingHelperModule {}
