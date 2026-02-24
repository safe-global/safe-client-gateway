import { Injectable } from '@nestjs/common';
import { type Safe } from '@/modules/safe/domain/entities/safe.entity';
import { type Transfer } from '@/modules/safe/domain/entities/transfer.entity';
import {
  TRANSACTION_ID_SEPARATOR,
  TRANSFER_PREFIX,
} from '@/modules/transactions/routes/constants';
import { TransactionDetails } from '@/modules/transactions/routes/entities/transaction-details/transaction-details.entity';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';
import { TransferInfoMapper } from '@/modules/transactions/routes/mappers/transfers/transfer-info.mapper';

@Injectable()
export class TransferDetailsMapper {
  constructor(private readonly transferInfoMapper: TransferInfoMapper) {}

  async mapDetails(
    chainId: string,
    transfer: Transfer,
    safe: Safe,
  ): Promise<TransactionDetails> {
    return {
      safeAddress: safe.address,
      txId: `${TRANSFER_PREFIX}${TRANSACTION_ID_SEPARATOR}${safe.address}${TRANSACTION_ID_SEPARATOR}${transfer.transferId}`,
      executedAt: transfer.executionDate.getTime(),
      txStatus: TransactionStatus.Success,
      txInfo: await this.transferInfoMapper.mapTransferInfo(
        chainId,
        transfer,
        safe,
      ),
      txData: null,
      detailedExecutionInfo: null,
      txHash: transfer.transactionHash,
      safeAppInfo: null,
      note: null,
    };
  }
}
