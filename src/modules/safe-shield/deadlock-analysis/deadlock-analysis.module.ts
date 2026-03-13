// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { DeadlockAnalysisService } from './deadlock-analysis.service';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [DeadlockAnalysisService],
  exports: [DeadlockAnalysisService],
})
export class DeadlockAnalysisModule {}
