import { Module } from '@nestjs/common';
import { ContractsController } from '@/modules/contracts/routes/contracts.controller';
import { ContractsService } from '@/modules/contracts/routes/contracts.service';
import { ContractsRepositoryModule } from '@/modules/contracts/domain/contracts.repository.interface';
import { ContractMapper } from '@/modules/contracts/routes/mappers/contract.mapper';

@Module({
  imports: [ContractsRepositoryModule],
  controllers: [ContractsController],
  providers: [ContractsService, ContractMapper],
})
export class ContractsModule {}
