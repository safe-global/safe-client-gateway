import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { IEstimationsRepository } from '@/modules/estimations/domain/estimations.repository.interface';
import { EstimationsRepository } from '@/modules/estimations/domain/estimations.repository';
import { EstimationsController } from '@/modules/estimations/routes/estimations.controller';
import { EstimationsService } from '@/modules/estimations/routes/estimations.service';

@Module({
  imports: [TransactionApiManagerModule, SafeRepositoryModule],
  providers: [
    {
      provide: IEstimationsRepository,
      useClass: EstimationsRepository,
    },
    EstimationsService,
  ],
  controllers: [EstimationsController],
  exports: [IEstimationsRepository],
})
export class EstimationsModule {}
