import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { IDataDecodedRepository } from './data-decoded.repository.interface';
import { DataDecodedValidator } from './data-decoded.validator';
import { DataDecoded } from './entities/data-decoded.entity';

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
