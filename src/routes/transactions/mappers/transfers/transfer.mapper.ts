import { Injectable } from '@nestjs/common';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { Transfer } from '@/domain/safe/entities/transfer.entity';
import { TRANSACTION_ID_SEPARATOR, TRANSFER_PREFIX } from '../../constants';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { Transaction } from '../../entities/transaction.entity';
import { TransferInfoMapper } from './transfer-info.mapper';

@Injectable()
export class IncomingTransferMapper {
  constructor(private readonly transferInfoMapper: TransferInfoMapper) {}

  async mapTransfer(
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
    );
  }
}
