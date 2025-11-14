import { Module } from '@nestjs/common';
import { EstimationsController } from '@/modules/estimations/routes/estimations.controller';
import { EstimationsService } from '@/modules/estimations/routes/estimations.service';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { EstimationsRepositoryModule } from '@/modules/estimations/domain/estimations.repository.interface';

@Module({
  imports: [EstimationsRepositoryModule, SafeRepositoryModule],
  controllers: [EstimationsController],
  providers: [EstimationsService],
})
export class EstimationsModule {}
