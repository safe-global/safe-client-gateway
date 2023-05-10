import { Injectable } from '@nestjs/common';
import { Safe } from '../../../../domain/safe/entities/safe.entity';
import { Transfer } from '../../../../domain/safe/entities/transfer.entity';
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
      transfer.transferId,
      transfer.executionDate.getTime(),
      TransactionStatus.Success,
      await this.transferInfoMapper.mapTransferInfo(chainId, transfer, safe),
      null,
      null,
    );
  }
}
