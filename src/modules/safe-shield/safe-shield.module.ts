// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ConfigApiModule } from '@/datasources/config-api/config-api.module';
import { ContractAnalysisModule } from '@/modules/safe-shield/contract-analysis/contract-analysis.module';
import { DeadlockAnalysisModule } from '@/modules/safe-shield/deadlock-analysis/deadlock-analysis.module';
import { ISafeShieldAnalysis } from '@/modules/safe-shield/domain/safe-shield-analysis.interface';
import { CopilotCoreDisabledExceptionFilter } from '@/modules/safe-shield/errors/copilot-core-disabled.exception-filter';
import { RecipientAnalysisModule } from '@/modules/safe-shield/recipient-analysis/recipient-analysis.module';
import { CopilotCoreGatingGuard } from '@/modules/safe-shield/routes/guards/copilot-core-gating.guard';
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
    CopilotCoreGatingGuard,
    CopilotCoreDisabledExceptionFilter,
  ],
  exports: [SafeShieldService, ISafeShieldAnalysis],
})
export class SafeShieldModule {}
