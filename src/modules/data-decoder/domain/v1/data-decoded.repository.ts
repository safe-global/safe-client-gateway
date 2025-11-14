import { Inject, Injectable } from '@nestjs/common';
import { IDataDecodedRepository } from '@/modules/data-decoder/domain/v1/data-decoded.repository.interface';
import { DataDecoded } from '@/modules/data-decoder/domain/v1/entities/data-decoded.entity';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { DataDecodedSchema } from '@/modules/data-decoder/domain/v1/entities/schemas/data-decoded.schema';
import type { Address } from 'viem';

@Injectable()
export class DataDecodedRepository implements IDataDecodedRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getDataDecoded(args: {
    chainId: string;
    data: Address;
    to?: Address;
  }): Promise<DataDecoded> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    const dataDecoded = await api.getDataDecoded({
      data: args.data,
      to: args.to,
    });
    return DataDecodedSchema.parse(dataDecoded);
  }
}
