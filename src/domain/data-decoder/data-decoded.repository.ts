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

  async decode(
    chainId: string,
    data: string,
    to: string,
  ): Promise<DataDecoded> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const result = await api.decode(data, to);
    return result; // TODO:
    // return this.validator.validate(result);
  }
}
