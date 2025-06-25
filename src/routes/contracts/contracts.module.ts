import { Module } from '@nestjs/common';
import { ContractsController } from '@/routes/contracts/contracts.controller';
import { ContractsService } from '@/routes/contracts/contracts.service';
import { ContractsRepositoryModule } from '@/domain/contracts/contracts.repository.interface';
import { ContractMapper } from '@/routes/contracts/mappers/contract.mapper';

@Module({
  imports: [ContractsRepositoryModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractMapper],
})
export class ContractsModule {}
