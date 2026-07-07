// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { BalancesModule } from '@/modules/balances/balances.module';
import { BlockchainModule } from '@/modules/blockchain/blockchain.module';
import { ChainsModule } from '@/modules/chains/chains.module';
import { CollectiblesModule } from '@/modules/collectibles/collectibles.module';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { DelegatesV2RepositoryModule } from '@/modules/delegate/domain/v2/delegates.v2.repository.interface';
import { EarnModule } from '@/modules/earn/earn.module';
import { EventCacheHelper } from '@/modules/hooks/domain/helpers/event-cache.helper';
import { MessagesModule } from '@/modules/messages/messages.module';
import { PortfolioModule } from '@/modules/portfolio/portfolio.module';
import { PositionsModule } from '@/modules/positions/positions.module';
import { SafeRepositoryModule } from '@/modules/safe/domain/safe.repository.interface';
import { SafeAppsModule } from '@/modules/safe-apps/safe-apps.module';
import { StakingModule } from '@/modules/staking/staking.module';
import { TransactionsModule } from '@/modules/transactions/transactions.module';

@Module({
  imports: [
    BalancesModule,
    BlockchainModule,
    ChainsModule,
    CollectiblesModule,
    DelegatesV2RepositoryModule,
    EarnModule,
    MessagesModule,
    PortfolioModule,
    PositionsModule,
    SafeAppsModule,
    SafeRepositoryModule,
    StakingModule,
    TransactionsModule,
  ],
  providers: [EventCacheHelper, SafeDecoder, MultiSendDecoder],
  exports: [EventCacheHelper],
})
export class EventCacheHelperModule {}
