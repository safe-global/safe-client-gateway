import { Module } from '@nestjs/common';
import { ContractAnalysisService } from './contract-analysis.service';
import { DataDecodedApiModule } from '@/modules/data-decoder/datasources/data-decoder-api.module';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

/**
 * Module for contract analysis functionality.
 *
 * This module provides services for analyzing contract interactions,
 * including verification status checks, interaction history, and delegatecall detection.
 */
@Module({
  imports: [DataDecodedApiModule, TransactionApiManagerModule],
  providers: [ContractAnalysisService, Erc20Decoder],
  exports: [ContractAnalysisService],
})
export class ContractAnalysisModule {}
