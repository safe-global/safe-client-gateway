import { IBridgeRepository } from '@/domain/bridge/bridge.repository.interface';
import { LiFiDecoder } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import { Inject, Injectable } from '@nestjs/common';
import { isAddressEqual } from 'viem';

@Injectable()
export class BridgeMapper {
  constructor(
    private readonly liFiDecoder: LiFiDecoder,
    private readonly transactionFinder: TransactionFinder,
    @Inject(IBridgeRepository)
    private readonly bridgeRepository: IBridgeRepository,
  ) {}

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  public async mapBridge(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }) {
    const transaction = await this.findTransactionByPredicate({
      ...args,
      predicate: this.liFiDecoder.isBridge,
    });

    if (!transaction) {
      return null;
    }

    return this.liFiDecoder.decodeBridgeAndMaybeSwap(transaction.data);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  public async mapSwap(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }) {
    const transaction = await this.findTransactionByPredicate({
      ...args,
      predicate: this.liFiDecoder.isSwap,
    });

    if (!transaction) {
      return null;
    }

    return this.liFiDecoder.decodeSwap(transaction.data);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  public async mapSwapAndBridge(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
  }) {
    const transaction = await this.findTransactionByPredicate({
      ...args,
      predicate: this.liFiDecoder.isSwapAndBridge,
    });

    if (!transaction) {
      return null;
    }

    return this.liFiDecoder.decodeBridgeAndMaybeSwap(transaction.data);
  }

  private async findTransactionByPredicate(args: {
    chainId: string;
    transaction: MultisigTransaction | ModuleTransaction;
    predicate: (data: `0x${string}`) => boolean;
  }): Promise<{
    to?: `0x${string}`;
    data: `0x${string}`;
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
