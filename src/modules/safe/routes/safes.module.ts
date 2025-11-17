import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { SafesController } from '@/modules/safe/routes/safes.controller';
import { SafesService } from '@/modules/safe/routes/safes.service';
import { BalancesRepositoryModule } from '@/modules/balances/domain/balances.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { MessagesRepositoryModule } from '@/modules/messages/domain/messages.repository.interface';

@Module({
  imports: [
    AddressInfoModule,
    BalancesRepositoryModule,
    ChainsRepositoryModule,
    MessagesRepositoryModule,
    SafeRepositoryModule,
  ],
  controllers: [SafesController],
  providers: [SafesService],
})
export class SafesModule {}
