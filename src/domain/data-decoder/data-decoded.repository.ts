import { Inject, Injectable } from '@nestjs/common';
import { IDataDecodedRepository } from '@/domain/data-decoder/data-decoded.repository.interface';
import { DataDecodedValidator } from '@/domain/data-decoder/data-decoded.validator';
import { DataDecoded } from '@/domain/data-decoder/entities/data-decoded.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class DataDecodedRepository implements IDataDecodedRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: DataDecodedValidator,
  ) {}

  async getDataDecoded(args: {
    chainId: string;
    data: string;
    to?: string;
  }): Promise<DataDecoded> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const dataDecoded = await api.getDataDecoded({
      data: args.data,
      to: args.to,
    });
    return this.validator.validate(dataDecoded);
  }
}
