// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ContractAnalysisModule } from '@/modules/safe-shield/contract-analysis/contract-analysis.module';
import { DeadlockAnalysisModule } from '@/modules/safe-shield/deadlock-analysis/deadlock-analysis.module';
import { SafeShieldCoreDisabledExceptionFilter } from '@/modules/safe-shield/domain/exception-filters/safe-shield-core-disabled.exception-filter';
import { ISafeShieldAnalysis } from '@/modules/safe-shield/domain/safe-shield-analysis.interface';
import { RecipientAnalysisModule } from '@/modules/safe-shield/recipient-analysis/recipient-analysis.module';
import { SafeShieldCoreGatingGuard } from '@/modules/safe-shield/routes/guards/safe-shield-core-gating.guard';
import { BlockaidApiModule } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.module';
import { ThreatAnalysisModule } from '@/modules/safe-shield/threat-analysis/threat-analysis.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { SafeShieldController } from './safe-shield.controller';
import { SafeShieldService } from './safe-shield.service';

@Module({
  imports: [
    ConfigApiModule,
    ContractAnalysisModule,
    DeadlockAnalysisModule,
    RecipientAnalysisModule,
    BlockaidApiModule,
    ThreatAnalysisModule,
    TransactionsModule,
  ],
  controllers: [SafeShieldController],
  providers: [
    SafeShieldService,
    { provide: ISafeShieldAnalysis, useExisting: SafeShieldService },
    SafeShieldCoreGatingGuard,
    SafeShieldCoreDisabledExceptionFilter,
  ],
  exports: [SafeShieldService, ISafeShieldAnalysis],
})
export class SafeShieldModule {}
