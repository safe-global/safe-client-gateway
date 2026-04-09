// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { ChainsModule } from '@/modules/chains/chains.module';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.module';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.module';
import { ContractsModule } from '@/modules/contracts/contracts.module';

@Module({
  imports: [
    ChainsModule,
    TransactionApiManagerModule,
    DelegatesV2RepositoryModule,
    ContractsModule,
  ],
  providers: [
    {
      provide: ISafeRepository,
      useClass: SafeRepository,
    },
    TransactionVerifierHelper,
  ],
  exports: [ISafeRepository],
})
export class SafeRepositoryModule {}
