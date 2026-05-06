// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { IDataDecodedRepository } from '@/modules/data-decoder/domain/v1/data-decoded.repository.interface';
import type { DataDecoded } from '@/modules/data-decoder/domain/v1/entities/data-decoded.entity';
import { DataDecodedSchema } from '@/modules/data-decoder/domain/v1/entities/schemas/data-decoded.schema';

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
