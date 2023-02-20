import { GetEstimationDto } from './entities/get-estimation.dto.entity';
import { Estimation } from './entities/estimation.entity';

export const IEstimationsRepository = Symbol('IEstimationsRepository');

export interface IEstimationsRepository {
  getEstimation(
    chainId: string,
    address: string,
    getEstimationDto: GetEstimationDto,
  ): Promise<Estimation>;
}
