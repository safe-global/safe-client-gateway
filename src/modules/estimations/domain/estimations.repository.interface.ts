import { Estimation } from '@/modules/estimations/domain/entities/estimation.entity';
import { GetEstimationDto } from '@/modules/estimations/domain/entities/get-estimation.dto.entity';
import { Module } from '@nestjs/common';
import { EstimationsRepository } from '@/modules/estimations/domain/estimations.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Address } from 'viem';

export const IEstimationsRepository = Symbol('IEstimationsRepository');

export interface IEstimationsRepository {
  getEstimation(args: {
    chainId: string;
    address: Address;
    getEstimationDto: GetEstimationDto;
  }): Promise<Estimation>;
}

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IEstimationsRepository,
      useClass: EstimationsRepository,
    },
  ],
  exports: [IEstimationsRepository],
})
export class EstimationsRepositoryModule {}
