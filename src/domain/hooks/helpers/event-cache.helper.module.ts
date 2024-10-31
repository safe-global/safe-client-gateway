import { Module } from '@nestjs/common';
import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { BlockchainRepositoryModule } from '@/domain/blockchain/blockchain.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';
import { EventCacheHelper } from '@/domain/hooks/helpers/event-cache.helper';
import { MessagesRepositoryModule } from '@/domain/messages/messages.repository.interface';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { TransactionsRepositoryModule } from '@/domain/transactions/transactions.repository.interface';

@Module({
  imports: [
    BalancesRepositoryModule,
    BlockchainRepositoryModule,
    ChainsRepositoryModule,
    CollectiblesRepositoryModule,
    MessagesRepositoryModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    StakingRepositoryModule,
    TransactionsRepositoryModule,
  ],
  providers: [EventCacheHelper],
  exports: [EventCacheHelper],
})
export class EventCacheHelperModule {}
