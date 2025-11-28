import { Module } from '@nestjs/common';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { IContractsRepository } from '@/modules/contracts/domain/contracts.repository.interface';
import { ContractsRepository } from '@/modules/contracts/domain/contracts.repository';
import { ContractsController } from '@/modules/contracts/routes/contracts.controller';
import { ContractsService } from '@/modules/contracts/routes/contracts.service';
import { ContractMapper } from '@/modules/contracts/routes/mappers/contract.mapper';

@Module({
  imports: [DataDecoderModule],
  providers: [
    {
      provide: IContractsRepository,
      useClass: ContractsRepository,
    },
    ContractsService,
    ContractMapper,
  ],
  controllers: [ContractsController],
  exports: [IContractsRepository],
})
export class ContractsModule {}
