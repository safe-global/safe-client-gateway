import { Inject, Injectable } from '@nestjs/common';
import { ITransactionApiManager } from '../interfaces/transaction-api.manager.interface';
import { GetEstimationDto } from './entities/get-estimation.dto.entity';
import { Estimation } from './entities/estimation.entity';
import { IEstimationsRepository } from './estimations.repository.interface';
import { EstimationsValidator } from './estimations.validator';

@Injectable()
export class EstimationsRepository implements IEstimationsRepository {
  constructor(
    @Inject(ITransactionApiManager)
    private readonly transactionApiManager: ITransactionApiManager,
    private readonly validator: EstimationsValidator,
  ) {}

  async getEstimation(
    chainId: string,
    address: string,
    getEstimationDto: GetEstimationDto,
  ): Promise<Estimation> {
    const api = await this.transactionApiManager.getTransactionApi(chainId);
    const data = await api.postEstimation(address, getEstimationDto);
    return this.validator.validate(data);
  }
}
