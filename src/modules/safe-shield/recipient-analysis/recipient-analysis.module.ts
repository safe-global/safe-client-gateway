import { Module } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis.service';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ChainsModule } from '@/modules/chains/chains.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';

/**
 * Module for recipient analysis functionality.
 *
 * This module provides services for analyzing transaction recipients,
 * including interaction history tracking and bridge configuration validation.
 */
@Module({
  imports: [TransactionApiManagerModule, TransactionsModule, ChainsModule],
  providers: [RecipientAnalysisService, Erc20Decoder],
  exports: [RecipientAnalysisService],
})
export class RecipientAnalysisModule {}
