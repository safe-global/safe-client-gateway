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
import { TransactionHistory } from '../../entities/transaction-history.entity';

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
  ): Promise<TransactionHistory[]> {
    const results = await transactionsDomain.map(async (transaction) => {
      if ('isExecuted' in transaction) {
        return new TransactionHistory(
          await this.multisigTransactionMapper.mapTransaction(
            chainId,
            transaction as MultisigTransaction,
            safe,
          ),
        );
      } else if ('module' in (transaction as ModuleTransaction)) {
        return new TransactionHistory(
          await this.moduleTransactionMapper.mapTransaction(
            chainId,
            transaction as ModuleTransaction,
            safe,
          ),
        );
      } else {
        return await Promise.all(
          (transaction as EthereumTransaction).transfers.map(
            async (transfer) =>
              new TransactionHistory(
                await this.incomingTransferMapper.mapTransfer(
                  chainId,
                  transfer,
                  safe,
                ),
              ),
          ),
        );
      }
    });

    return flatten(await Promise.all(results));
  }
}
