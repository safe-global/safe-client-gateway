import { Module } from '@nestjs/common';
import { SafeShieldService } from './safe-shield.service';
import { SafeShieldController } from './safe-shield.controller';
import { RecipientAnalysisModule } from './recipient-analysis/recipient-analysis.module';
import { ContractAnalysisModule } from './contract-analysis/contract-analysis.module';
import { ThreatAnalysisModule } from './threat-analysis/threat-analysis.module';
import { TransactionsModule } from '@/routes/transactions/transactions.module';

/**
 * Main module for Safe Shield transaction analysis system.
 *
 * This module orchestrates all analysis types and provides the main
 * entry point for transaction safety checks. It imports all analysis
 * modules and exports the main SafeShieldService.
 */
@Module({
  imports: [
    RecipientAnalysisModule,
    ContractAnalysisModule,
    ThreatAnalysisModule,
    TransactionsModule,
  ],
  controllers: [SafeShieldController],
  providers: [SafeShieldService],
  exports: [SafeShieldService],
})
export class SafeShieldModule {}
