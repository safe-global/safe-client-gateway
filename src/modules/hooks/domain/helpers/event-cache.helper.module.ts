import { Module } from '@nestjs/common';
import { BalancesModule } from '@/modules/balances/balances.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { CollectiblesModule } from '@/modules/collectibles/collectibles.module';
import { EarnModule } from '@/modules/earn/earn.module';
import { EventCacheHelper } from '@/modules/hooks/domain/helpers/event-cache.helper';
import { MessagesModule } from '@/modules/messages/messages.module';
import { SafeAppsModule } from '@/modules/safe-apps/safe-apps.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { StakingModule } from '@/modules/staking/staking.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';

@Module({
  imports: [
    BalancesModule,
    BlockchainModule,
    ChainsModule,
    CollectiblesModule,
    DelegatesV2RepositoryModule,
    EarnModule,
    MessagesModule,
    SafeAppsModule,
    SafeRepositoryModule,
    StakingModule,
    TransactionsModule,
  ],
  providers: [EventCacheHelper],
  exports: [EventCacheHelper],
})
export class EventCacheHelperModule {}
