import { Module } from '@nestjs/common';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { SafesController } from '@/routes/safes/safes.controller';
import { SafesService } from '@/routes/safes/safes.service';
import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { MessagesRepositoryModule } from '@/domain/messages/messages.repository.interface';

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
