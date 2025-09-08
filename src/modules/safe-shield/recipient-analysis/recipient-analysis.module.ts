import { Module } from '@nestjs/common';
import { RecipientAnalysisService } from './recipient-analysis.service';

/**
 * Module for recipient analysis functionality.
 * 
 * This module provides services for analyzing transaction recipients,
 * including interaction history tracking and bridge configuration validation.
 */
@Module({
  providers: [RecipientAnalysisService],
  exports: [RecipientAnalysisService],
})
export class RecipientAnalysisModule {}
