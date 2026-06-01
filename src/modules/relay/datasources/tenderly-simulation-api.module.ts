// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ITenderlySimulationApi } from '@/domain/interfaces/tenderly-simulation-api.interface';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { TenderlySimulationApi } from '@/modules/relay/datasources/tenderly-simulation-api.service';

@Module({
  imports: [BlockchainModule],
  providers: [
    { provide: ITenderlySimulationApi, useClass: TenderlySimulationApi },
  ],
  exports: [ITenderlySimulationApi],
})
export class TenderlySimulationApiModule {}
