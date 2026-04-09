// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IDelegateRepository } from '@/modules/delegate/domain/delegate.repository.interface';
import { DelegateRepository } from '@/modules/delegate/domain/delegate.repository';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.module';

@Module({
  imports: [TransactionApiManagerModule],
  providers: [
    {
      provide: IDelegateRepository,
      useClass: DelegateRepository,
    },
  ],
  exports: [IDelegateRepository],
})
export class DelegateRepositoryModule {}
