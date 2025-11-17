import { Inject, Injectable } from '@nestjs/common';
import { Estimation } from '@/modules/estimations/domain/entities/estimation.entity';
import { GetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';
import { IEstimationsRepository } from '@/modules/estimations/domain/estimations.repository.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { EstimationSchema } from '@/modules/estimations/domain/entities/schemas/estimation.schema';
import type { Address } from 'viem';

@Injectable()
export class EstimationsRepository implements IEstimationsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getEstimation(args: {
    chainId: string;
    address: Address;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation> {
    const api = await this.transactionApiManager.getApi(args.chainId);
    const data = await api.getEstimation(args);
    return EstimationSchema.parse(data);
  }
}
