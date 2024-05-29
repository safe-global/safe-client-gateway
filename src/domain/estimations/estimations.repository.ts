import { Inject, Injectable } from '@nestjs/common';
import { Estimation } from '@/domain/estimations/entities/estimation.entity';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { IEstimationsRepository } from '@/domain/estimations/estimations.repository.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { EstimationSchema } from '@/domain/estimations/entities/schemas/estimation.schema';

@Injectable()
export class EstimationsRepository implements IEstimationsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
  ) {}

  async getEstimation(args: {
    chainId: string;
    address: `0x${string}`;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const data = await api.getEstimation(args);
    return EstimationSchema.parse(data);
  }
}
