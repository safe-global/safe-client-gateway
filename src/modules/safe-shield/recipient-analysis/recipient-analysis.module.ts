import { Module } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis.service';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { TransactionsModule } from '@/routes/transactions/transactions.module';

/**
 * Module for recipient analysis functionality.
 *
 * This module provides services for analyzing transaction recipients,
 * including interaction history tracking and bridge configuration validation.
 */
@Module({
  imports: [
    TransactionApiManagerModule,
    TransactionsModule,
    ChainsRepositoryModule,
  ],
  providers: [RecipientAnalysisService, Erc20Decoder],
  exports: [RecipientAnalysisService],
})
export class RecipientAnalysisModule {}
