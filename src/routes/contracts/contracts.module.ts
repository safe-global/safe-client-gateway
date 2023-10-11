import { Module } from '@nestjs/common';
import { ContractsController } from '@/routes/contracts/contracts.controller';
import { ContractsService } from '@/routes/contracts/contracts.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
