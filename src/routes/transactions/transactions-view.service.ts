import { TransactionDataDto } from '@/routes/common/entities/transaction-data.dto.entity';
import { ConfirmationView } from '@/routes/transactions/entities/confirmation-view/confirmation-view.entity';
import { Inject, Injectable } from '@nestjs/common';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';

@Injectable({})
export class TransactionsViewService {
  constructor(
    @Inject(IDataDecodedRepository)
    private readonly dataDecodedRepository: IDataDecodedRepository,
  ) {}

  async getTransactionConfirmationView(args: {
    chainId: string;
    transactionDataDto: TransactionDataDto;
  }): Promise<ConfirmationView> {
    const dataDecoded = await this.dataDecodedRepository.getDataDecoded({
      chainId: args.chainId,
      data: args.transactionDataDto.data,
      to: args.transactionDataDto.to,
    });

    return new ConfirmationView({
      method: dataDecoded.method,
      parameters: dataDecoded.parameters,
    });
  }
}
