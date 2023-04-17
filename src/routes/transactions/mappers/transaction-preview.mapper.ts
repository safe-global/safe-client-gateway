import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { MultisigTransaction } from '../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import { DataDecodedService } from '../../data-decode/data-decoded.service';
import { GetDataDecodedDto } from '../../data-decode/entities/get-data-decoded.dto.entity';
import { PreviewTransactionDto } from '../entities/preview-transaction.dto.entity';
import { TransactionPreview } from '../entities/transaction-preview.entity';
import { TransactionDataMapper } from './common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from './common/transaction-info.mapper';

@Injectable()
export class TransactionPreviewMapper {
  constructor(
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    private readonly dataDecodedService: DataDecodedService,
  ) {}

  async mapTransactionPreview(
    chainId: string,
    safe: Safe,
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    let dataDecoded;
    try {
      if (previewTransactionDto.data !== null) {
        dataDecoded = await this.dataDecodedService.getDataDecoded(
          chainId,
          new GetDataDecodedDto(
            previewTransactionDto.data,
            previewTransactionDto.to,
          ),
        );
      }
    } catch (error) {
      winston.warn(`Error trying to decode the input data: ${error.message}`);
      dataDecoded = previewTransactionDto.data;
    }
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      <MultisigTransaction>{
        safe: safe.address,
        to: previewTransactionDto.to,
        value: previewTransactionDto.value,
        dataDecoded,
        data: previewTransactionDto.data,
        operation: previewTransactionDto.operation,
      },
      safe,
    );
    const txData = await this.transactionDataMapper.mapTransactionData(
      chainId,
      previewTransactionDto,
      dataDecoded,
    );
    return Promise.resolve(new TransactionPreview(txInfo, txData));
  }
}
