import { Module } from '@nestjs/common';
import { ContractAnalysisService } from './contract-analysis.service';
import { DataDecodedApiModule } from '@/datasources/data-decoder-api/data-decoder-api.module';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';

/**
 * Module for contract analysis functionality.
 *
 * This module provides services for analyzing contract interactions,
 * including verification status checks, interaction history, and delegatecall detection.
 */
@Module({
  imports: [DataDecodedApiModule],
  providers: [ContractAnalysisService, Erc20Decoder],
  exports: [ContractAnalysisService],
})
export class ContractAnalysisModule {}
