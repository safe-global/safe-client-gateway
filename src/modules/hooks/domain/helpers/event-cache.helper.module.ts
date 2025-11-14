import { Module } from '@nestjs/common';
import { BalancesRepositoryModule } from '@/modules/balances/domain/balances.repository.interface';
import { BlockchainRepositoryModule } from '@/modules/blockchain/domain/blockchain.repository.interface';
import { ChainsRepositoryModule } from '@/modules/chains/domain/chains.repository.interface';
import { CollectiblesRepositoryModule } from '@/modules/collectibles/domain/collectibles.repository.interface';
import { EarnRepositoryModule } from '@/modules/earn/domain/earn.repository.module';
import { EventCacheHelper } from '@/modules/hooks/domain/helpers/event-cache.helper';
import { MessagesRepositoryModule } from '@/modules/messages/domain/messages.repository.interface';
import { SafeAppsRepositoryModule } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { StakingRepositoryModule } from '@/modules/staking/domain/staking.repository.module';
import { TransactionsRepositoryModule } from '@/modules/transactions/domain/transactions.repository.interface';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';

@Module({
  imports: [
    BalancesRepositoryModule,
    BlockchainRepositoryModule,
    ChainsRepositoryModule,
    CollectiblesRepositoryModule,
    DelegatesV2RepositoryModule,
    EarnRepositoryModule,
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
