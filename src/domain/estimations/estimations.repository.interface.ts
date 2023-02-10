import { EstimationRequest } from './entities/estimation-request.entity';
import { Estimation } from './entities/estimation.entity';

export const IEstimationsRepository = Symbol('IEstimationsRepository');

export interface IEstimationsRepository {
  getEstimation(
    chainId: string,
    address: string,
    estimationRequest: EstimationRequest,
  ): Promise<Estimation>;
}
