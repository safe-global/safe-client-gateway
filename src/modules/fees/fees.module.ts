// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { FeeServiceApiModule } from '@/datasources/fee-service-api/fee-service-api.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { GasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository';
import { IGasTokensRepository } from '@/modules/fees/domain/gas-tokens.repository.interface';
import { FeesController } from '@/modules/fees/routes/fees.controller';
import { FeesService } from '@/modules/fees/routes/fees.service';

@Module({
  imports: [FeeServiceApiModule, ConfigApiModule, ChainsModule],
  controllers: [FeesController],
  providers: [
    FeesService,
    { provide: IGasTokensRepository, useClass: GasTokensRepository },
  ],
})
export class FeesModule {}
