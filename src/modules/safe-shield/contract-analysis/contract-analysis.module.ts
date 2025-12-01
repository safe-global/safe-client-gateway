import { Module } from '@nestjs/common';
import { ContractAnalysisService } from './contract-analysis.service';
import { DataDecoderModule } from '@/modules/data-decoder/data-decoder.module';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

/**
 * Module for contract analysis functionality.
 *
 * This module provides services for analyzing contract interactions,
 * including verification status checks, interaction history, and delegatecall detection.
 */
@Module({
  imports: [DataDecoderModule, TransactionApiManagerModule],
  providers: [ContractAnalysisService, Erc20Decoder],
  exports: [ContractAnalysisService],
})
export class ContractAnalysisModule {}
