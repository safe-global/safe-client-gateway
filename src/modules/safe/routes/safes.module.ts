import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { SafesController } from '@/modules/safe/routes/safes.controller';
import { SafesService } from '@/modules/safe/routes/safes.service';
import { BalancesRepositoryModule } from '@/modules/balances/domain/balances.repository.interface';
import { ChainsModule } from '@/modules/chains/chains.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { MessagesModule } from '@/modules/messages/messages.module';

@Module({
  imports: [
    AddressInfoModule,
    BalancesRepositoryModule,
    ChainsModule,
    MessagesModule,
    SafeRepositoryModule,
  ],
  controllers: [SafesController],
  providers: [SafesService],
})
export class SafesModule {}
