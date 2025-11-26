import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ContractAnalysisModule } from '@/modules/safe-shield/contract-analysis/contract-analysis.module';
import { RecipientAnalysisModule } from '@/modules/safe-shield/recipient-analysis/recipient-analysis.module';
import { BlockaidApiModule } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.module';
import { ThreatAnalysisModule } from '@/modules/safe-shield/threat-analysis/threat-analysis.module';
import { TransactionsModule } from '@/modules/transactions/routes/transactions.module';
import { SafeShieldService } from './safe-shield.service';
import { SafeShieldController } from './safe-shield.controller';

@Module({
  imports: [
    ConfigApiModule,
    ContractAnalysisModule,
    RecipientAnalysisModule,
    BlockaidApiModule,
    ThreatAnalysisModule,
    TransactionsModule,
  ],
  controllers: [SafeShieldController],
  providers: [SafeShieldService],
  exports: [SafeShieldService],
})
export class SafeShieldModule {}
