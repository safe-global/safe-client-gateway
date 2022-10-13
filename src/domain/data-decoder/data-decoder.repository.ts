import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { IDataDecoderRepository } from './data-decoder.repository.interface';
import { DataDecodedValidator } from './date-decoder.validator';
import { DataDecoded } from './entities/data-decoded.entity';

@Injectable()
export class DataDecoderRepository implements IDataDecoderRepository {
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
    return this.validator.validate(result);
  }
}
