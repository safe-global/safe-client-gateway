// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { PolicyCacheService } from '@/modules/policies/domain/policy-cache.service';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [PolicyCacheService],
  exports: [PolicyCacheService],
})
export class PolicyCacheModule {}
