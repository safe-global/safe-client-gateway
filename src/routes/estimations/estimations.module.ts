import { Module } from '@nestjs/common';
import { EstimationsController } from '@/routes/estimations/estimations.controller';
import { EstimationsService } from '@/routes/estimations/estimations.service';

@Module({
  controllers: [EstimationsController],
  providers: [EstimationsService],
})
export class EstimationsModule {}
