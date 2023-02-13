import { Module } from '@nestjs/common';
import { EstimationsController } from './estimations.controller';
import { EstimationsService } from './estimations.service';

@Module({
  controllers: [EstimationsController],
  providers: [EstimationsService],
})
export class EstimationsModule {}
