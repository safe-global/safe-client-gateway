import type { Address } from 'viem';
import type { Estimation } from '@/modules/estimations/domain/entities/estimation.entity';
import type { GetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';

export const IEstimationsRepository = Symbol('IEstimationsRepository');

export interface IEstimationsRepository {
  getEstimation(args: {
    chainId: string;
    address: Address;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation>;
}
