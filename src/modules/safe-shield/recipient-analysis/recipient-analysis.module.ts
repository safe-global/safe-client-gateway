// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { ChainsModule } from '@/modules/chains/chains.module';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { RecipientAnalysisService } from './recipient-analysis.service';

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
