import { Inject, Injectable } from '@nestjs/common';
import { Estimation } from '@/domain/estimations/entities/estimation.entity';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { IEstimationsRepository } from '@/domain/estimations/estimations.repository.interface';
import { EstimationsValidator } from '@/domain/estimations/estimations.validator';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';

@Injectable()
export class EstimationsRepository implements IEstimationsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: EstimationsValidator,
  ) {}

  async getEstimation(args: {
    chainId: string;
    address: string;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation> {
    const api = await this.transactionApiManager.getTransactionApi(
      args.chainId,
    );
    const data = await api.getEstimation(args);
    return this.validator.validate(data);
  }
}
