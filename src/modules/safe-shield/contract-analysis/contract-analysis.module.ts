import { Module } from '@nestjs/common';
import { ContractAnalysisService } from './contract-analysis.service';
import { DataDecodedApiModule } from '@/datasources/data-decoder-api/data-decoder-api.module';

/**
 * Module for contract analysis functionality.
 *
 * This module provides services for analyzing contract interactions,
 * including verification status checks, interaction history, and delegatecall detection.
 */
@Module({
  imports: [DataDecodedApiModule],
  providers: [ContractAnalysisService],
  exports: [ContractAnalysisService],
})
export class ContractAnalysisModule {}
