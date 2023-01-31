import { Injectable } from '@nestjs/common';
import { Transaction as TransactionDomain } from '../../../../domain/safe/entities/transaction.entity';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { ModuleTransactionMapper } from '../module-transactions/module-transaction.mapper';
import { MultisigTransactionMapper } from '../multisig-transactions/multisig-transaction.mapper';
import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '../../../../domain/safe/entities/module-transaction.entity';
import { EthereumTransaction } from '../../../../domain/safe/entities/ethereum-transaction.entity';
import { flatten } from 'lodash';
import { IncomingTransferMapper } from '../transfers/transfer.mapper';
import { TransactionItem } from '../../entities/transaction-item.entity';

@Injectable()
export class TransactionMapper {
  constructor(
    private readonly multisigTransactionMapper: MultisigTransactionMapper,
    private readonly moduleTransactionMapper: ModuleTransactionMapper,
    private readonly incomingTransferMapper: IncomingTransferMapper,
  ) {}
  async mapTransaction(
    chainId: string,
    transactionsDomain: TransactionDomain[],
    safe: Safe,
  ): Promise<TransactionItem[]> {
    const results = await transactionsDomain.map(async (transaction) => {
      if ('isExecuted' in transaction) {
        return new TransactionItem(
          await this.multisigTransactionMapper.mapTransaction(
            chainId,
            transaction as MultisigTransaction,
            safe,
          ),
        );
      } else if ('module' in (transaction as ModuleTransaction)) {
        return new TransactionItem(
          await this.moduleTransactionMapper.mapTransaction(
            chainId,
            transaction as ModuleTransaction,
            safe,
          ),
        );
      } else {
        const transfers = (transaction as EthereumTransaction).transfers;
        return transfers
          ? await Promise.all(
              transfers.map(
                async (transfer) =>
                  new TransactionItem(
                    await this.incomingTransferMapper.mapTransfer(
                      chainId,
                      transfer,
                      safe,
                    ),
                  ),
              ),
            )
          : null;
      }
    });

    return flatten(await Promise.all(results));
  }
}
