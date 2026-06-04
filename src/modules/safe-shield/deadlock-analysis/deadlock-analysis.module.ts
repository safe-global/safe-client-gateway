// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { DeadlockAnalysisService } from './deadlock-analysis.service';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [DeadlockAnalysisService],
  exports: [DeadlockAnalysisService],
})
export class DeadlockAnalysisModule {}
