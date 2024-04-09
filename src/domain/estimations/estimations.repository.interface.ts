import { Estimation } from '@/domain/estimations/entities/estimation.entity';
import { GetEstimationDto } from '@/domain/estimations/entities/get-estimation.dto.entity';
import { Module } from '@nestjs/common';
import { EstimationsRepository } from '@/domain/estimations/estimations.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

export const IEstimationsRepository = Symbol('IEstimationsRepository');

export interface IEstimationsRepository {
  getEstimation(args: {
    chainId: string;
    address: string;
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
