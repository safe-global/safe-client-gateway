import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import { BridgeRepositoryModule } from '@/domain/bridge/bridge.repository.module';
import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import {
  TransactionFinder,
  TransactionFinderModule,
} from '@/modules/transactions/routes/helpers/transaction-finder.helper';
import { Inject, Injectable, Module } from '@nestjs/common';
import { type Address, isAddressEqual } from 'viem';

@Injectable()
export class LiFiHelper {
  constructor(
    private readonly liFiDecoder: LiFiDecoder,
    private readonly transactionFinder: TransactionFinder,
    @Inject(IBridgeRepository)
    private readonly bridgeRepository: IBridgeRepository,
  ) {}

  public async getBridgeTransaction(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<{
    to?: Address;
    data: Address;
    value: string;
  } | null> {
    return await this.findTransactionByPredicate({
      ...args,
      predicate: (data) => {
        return this.liFiDecoder.isBridge({ chainId: args.chainId, data });
      },
    });
  }

  public async getSwapTransaction(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<{
    to?: Address;
    data: Address;
    value: string;
  } | null> {
    return await this.findTransactionByPredicate({
      ...args,
      predicate: (data) => {
        return this.liFiDecoder.isSwap({ chainId: args.chainId, data });
      },
    });
  }

  public async getSwapAndBridgeTransaction(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }): Promise<{
    to?: Address;
    data: Address;
    value: string;
  } | null> {
    return await this.findTransactionByPredicate({
      ...args,
      predicate: (data) => {
        return this.liFiDecoder.isSwapAndBridge({
          chainId: args.chainId,
          data,
        });
      },
    });
  }

  private async findTransactionByPredicate(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
    predicate: (data: Address) => boolean;
  }): Promise<{
    to?: Address;
    data: Address;
    value: string;
  } | null> {
    if (!args.transaction.data || args.transaction.data === '0x') {
      return null;
    }

    const diamondAddress = await this.bridgeRepository.getDiamondAddress(
      args.chainId,
    );

    return this.transactionFinder.findTransaction(
      ({ to, data }) => {
        if (!to || !isAddressEqual(to, diamondAddress)) {
          return false;
        }
        return args.predicate(data);
      },
      {
        to: args.transaction.to,
        data: args.transaction.data,
        value: args.transaction.value ?? '0',
      },
    );
  }
}
@Module({
  imports: [TransactionFinderModule, BridgeRepositoryModule],
  providers: [LiFiHelper, LiFiDecoder],
  exports: [LiFiHelper, LiFiDecoder],
})
export class LiFiHelperModule {}
