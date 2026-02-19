import { Inject, Injectable } from '@nestjs/common';
import { IDataDecoderRepository } from '@/modules/data-decoder/domain/v2/data-decoder.repository.interface';
import { type MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { type Safe } from '@/modules/safe/domain/entities/safe.entity';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { PreviewTransactionDto } from '@/modules/transactions/routes/entities/preview-transaction.dto.entity';
import { TransactionPreview } from '@/modules/transactions/routes/entities/transaction-preview.entity';
import { TransactionDataMapper } from '@/modules/transactions/routes/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/modules/transactions/routes/mappers/common/transaction-info.mapper';
import { type DataDecoded } from '@/modules/data-decoder/domain/v2/entities/data-decoded.entity';
import { asError } from '@/logging/utils';

@Injectable()
export class TransactionPreviewMapper {
  constructor(
    private readonly transactionInfoMapper: MultisigTransactionInfoMapper,
    private readonly transactionDataMapper: TransactionDataMapper,
    @Inject(IDataDecoderRepository)
    private readonly dataDecoderRepository: IDataDecoderRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async mapTransactionPreview(
    chainId: string,
    safe: Safe,
    previewTransactionDto: PreviewTransactionDto,
  ): Promise<TransactionPreview> {
    const multisigTransaction = {
      safe: safe.address,
      to: previewTransactionDto.to,
      value: previewTransactionDto.value,
      data: previewTransactionDto.data,
      operation: previewTransactionDto.operation,
      // Keep type safety as only the above are available in previewTransactionDto
    } as MultisigTransaction;

    let dataDecoded: DataDecoded | null = null;
    try {
      if (previewTransactionDto.data !== null) {
        dataDecoded =
          await this.dataDecoderRepository.getTransactionDataDecoded({
            chainId,
            transaction: multisigTransaction,
          });
      }
    } catch (error) {
      this.loggingService.info(
        `Error trying to decode the input data: ${asError(error).message}`,
      );
    }
    const txInfo = await this.transactionInfoMapper.mapTransactionInfo(
      chainId,
      multisigTransaction,
      dataDecoded,
    );
    const txData = await this.transactionDataMapper.mapTransactionData(
      chainId,
      previewTransactionDto,
      dataDecoded,
      safe.address,
    );
    return Promise.resolve(new TransactionPreview(txInfo, txData));
  }
}
