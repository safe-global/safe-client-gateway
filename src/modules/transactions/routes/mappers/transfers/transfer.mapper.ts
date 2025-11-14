import { Injectable } from '@nestjs/common';
import { Safe } from '@/modules/safe/domain/entities/safe.entity';
import { Transfer } from '@/modules/safe/domain/entities/transfer.entity';
import {
  TRANSACTION_ID_SEPARATOR,
  TRANSFER_PREFIX,
} from '@/modules/transactions/routes/constants';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';
import { TransferInfoMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-info.mapper';
import { Transaction } from '@/modules/transactions/routes/entities/transaction.entity';
import { isTransferTransactionInfo } from '@/modules/transactions/routes/entities/transfer-transaction-info.entity';
import { isErc20Transfer } from '@/modules/transactions/routes/entities/transfers/erc20-transfer.entity';
import { isSwapTransferTransactionInfo } from '@/modules/transactions/routes/swap-transfer-transaction-info.entity';

@Injectable()
export class TransferMapper {
  constructor(private readonly transferInfoMapper: TransferInfoMapper) {}

  private async mapTransfer(
    chainId: string,
    transfer: Transfer,
    safe: Safe,
  ): Promise<Transaction> {
    return new Transaction(
      `${TRANSFER_PREFIX}${TRANSACTION_ID_SEPARATOR}${safe.address}${TRANSACTION_ID_SEPARATOR}${transfer.transferId}`,
      transfer.executionDate.getTime(),
      TransactionStatus.Success,
      await this.transferInfoMapper.mapTransferInfo(chainId, transfer, safe),
      null,
      null,
      null,
      transfer.transactionHash,
    );
  }

  async mapTransfers(args: {
    chainId: string;
    transfers: Array<Transfer>;
    safe: Safe;
    onlyTrusted: boolean;
  }): Promise<Array<Transaction>> {
    const transactions = await Promise.all(
      args.transfers.map((transfer) =>
        this.mapTransfer(args.chainId, transfer, args.safe),
      ),
    );

    return transactions.filter((transaction): boolean => {
      // We are interested in transfers that:
      // - Have value and:
      // - If onlyTrusted is true then it should be a trusted transfer
      // - If onlyTrusted is false then any transfer is valid
      return (
        this.isTransferWithValue(transaction) &&
        (!args.onlyTrusted || this.isTrustedTransfer(transaction))
      );
    });
  }

  /**
   * Returns true if it is an ERC20 transfer with value.
   * Returns false otherwise.
   *
   * @private
   */
  private isTransferWithValue(transaction: Transaction): boolean {
    if (
      !isTransferTransactionInfo(transaction.txInfo) &&
      !isSwapTransferTransactionInfo(transaction.txInfo)
    )
      return true;
    if (!isErc20Transfer(transaction.txInfo.transferInfo)) return true;

    return Number(transaction.txInfo.transferInfo.value) > 0;
  }

  private isTrustedTransfer(transaction: Transaction): boolean {
    if (
      !isTransferTransactionInfo(transaction.txInfo) &&
      !isSwapTransferTransactionInfo(transaction.txInfo)
    )
      return true;
    if (!isErc20Transfer(transaction.txInfo.transferInfo)) return true;

    return !!transaction.txInfo.transferInfo.trusted;
  }
}
