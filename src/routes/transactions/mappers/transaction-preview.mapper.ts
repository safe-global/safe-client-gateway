import { Inject, Injectable } from '@nestjs/common';
import { DataDecodedRepository } from '../../../domain/data-decoder/data-decoded.repository';
import { IDataDecodedRepository } from '../../../domain/data-decoder/data-decoded.repository.interface';
import { MultisigTransaction } from '../../../domain/safe/entities/multisig-transaction.entity';
import { Safe } from '../../../domain/safe/entities/safe.entity';
import {
  ILoggingService,
  LoggingService,
} from '../../../logging/logging.interface';
import { PreviewTransactionDto } from '../entities/preview-transaction.dto.entity';
import { TransactionPreview } from '../entities/transaction-preview.entity';
import { TransactionDataMapper } from './common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from './common/transaction-info.mapper';
import { ReadableDescriptionsMapper } from './common/readable-descriptions.mapper';

@Injectable()
export class TransactionPreviewMapper {
  constructor(
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    private readonly readableDescriptionsMapper: ReadableDescriptionsMapper,
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: DataDecodedRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async mapTransactionPreview(
    chainId: string,
    safe: Safe,
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    let dataDecoded;
    try {
      if (previewTransactionDto.data !== null) {
        dataDecoded = await this.dataDecodedRepository.getDataDecoded({
          chainId,
          data: previewTransactionDto.data,
          to: previewTransactionDto.to,
        });
      }
    } catch (error) {
      this.loggingService.info(
        `Error trying to decode the input data: ${error.message}`,
      );
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
    );

    const txData = await this.transactionDataMapper.mapTransactionData(
      chainId,
      previewTransactionDto,
      dataDecoded,
    );

    const readableDescription =
      await this.readableDescriptionsMapper.mapReadableDescription(
        previewTransactionDto.to,
        previewTransactionDto.data,
        chainId,
      );

    return Promise.resolve(
      new TransactionPreview({ ...txInfo, readableDescription }, txData),
    );
  }
}
