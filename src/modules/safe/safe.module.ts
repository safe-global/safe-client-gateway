import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { SafesController } from '@/modules/safe/routes/safes.controller';
import { SafesService } from '@/modules/safe/routes/safes.service';
import { SafesV2Controller } from '@/modules/safe/routes/v2/safes.v2.controller';
import { SafesV2Service } from '@/modules/safe/routes/v2/safes.v2.service';
import { BalancesModule } from '@/modules/balances/balances.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { MessagesModule } from '@/modules/messages/messages.module';
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import { TransactionApiManagerModule } from '@/domain/interfaces/transaction-api.manager.interface';
import { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { ContractsModule } from '@/modules/contracts/contracts.module';

@Module({
  imports: [
    AddressInfoModule,
    BalancesModule,
    ChainsModule,
    MessagesModule,
    TransactionApiManagerModule,
    DelegatesV2RepositoryModule,
    ContractsModule,
  ],
  controllers: [SafesController, SafesV2Controller],
  providers: [
    {
      provide: ISafeRepository,
      useClass: SafeRepository,
    },
    TransactionVerifierHelper,
    SafesService,
    SafesV2Service,
  ],
  exports: [ISafeRepository],
})
export class SafeModule {}
