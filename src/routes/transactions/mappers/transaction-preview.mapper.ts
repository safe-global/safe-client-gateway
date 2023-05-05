import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../../domain/data-decoder/data-decoded.repository.interface';
import { MultisigTransaction } from '../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import { PreviewTransactionDto } from '../entities/preview-transaction.dto.entity';
import { TransactionPreview } from '../entities/transaction-preview.entity';
import { TransactionDataMapper } from './common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from './common/transaction-info.mapper';

@Injectable()
export class TransactionPreviewMapper {
  constructor(
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
  ) {}

  async mapTransactionPreview(
    chainId: string,
    safe: Safe,
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    let dataDecoded;
    try {
      if (previewTransactionDto.data !== null) {
        dataDecoded = await this.dataDecodedRepository.getDataDecoded(
          chainId,
          previewTransactionDto.data,
          previewTransactionDto.to,
        );
      }
    } catch (error) {
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
