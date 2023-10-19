import { Estimation } from '@/domain/estimations/entities/estimation.entity';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';

export const IEstimationsRepository = Symbol('IEstimationsRepository');

export interface IEstimationsRepository {
  getEstimation(args: {
    chainId: string;
    address: string;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation>;
}
