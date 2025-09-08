import { Module } from '@nestjs/common';
import { ContractAnalysisService } from './contract-analysis.service';

/**
 * Module for contract analysis functionality.
 * 
 * This module provides services for analyzing contract interactions,
 * including verification status checks, interaction history, and delegatecall detection.
 */
@Module({
  providers: [ContractAnalysisService],
  exports: [ContractAnalysisService],
})
export class ContractAnalysisModule {}
