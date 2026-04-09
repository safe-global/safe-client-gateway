// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IDelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { DelegatesV2Repository } from '@/modules/delegate/domain/v2/delegates.v2.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.module';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IDelegatesV2Repository,
      useClass: DelegatesV2Repository,
    },
  ],
  exports: [IDelegatesV2Repository],
})
export class DelegatesV2RepositoryModule {}
