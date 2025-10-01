import { Module } from '@nestjs/common';
import { ThreatAnalysisService } from './threat-analysis.service';
import { BlockaidApiModule } from '@/modules/safe-shield/threat-analysis/blockaid/blockaid-api.module';

/**
 * Module for threat analysis functionality.
 *
 * This module provides services for analyzing transactions for security threats,
 * including general threat detection and Safe-specific security checks.
 */
@Module({
  imports: [BlockaidApiModule],
  providers: [ThreatAnalysisService],
  exports: [ThreatAnalysisService],
})
export class ThreatAnalysisModule {}
