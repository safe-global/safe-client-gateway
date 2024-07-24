import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { BlockchainRepositoryModule } from '@/domain/blockchain/blockchain.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';
import {
  HooksRepository,
  HooksRepositoryWithNotifications,
} from '@/domain/hooks/hooks.repository';
import { MessagesRepositoryModule } from '@/domain/messages/messages.repository.interface';
import { NotificationsRepositoryV2Module } from '@/domain/notifications/notifications.repository.v2.interface';
import { QueuesRepositoryModule } from '@/domain/queues/queues-repository.interface';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { TransactionsRepositoryModule } from '@/domain/transactions/transactions.repository.interface';
import { Event } from '@/routes/hooks/entities/event.entity';
import { Module } from '@nestjs/common';

export const IHooksRepository = Symbol('IHooksRepository');

export interface IHooksRepository {
  onEvent(event: Event): Promise<unknown>;
}

@Module({
  imports: [
    BalancesRepositoryModule,
    BlockchainRepositoryModule,
    ChainsRepositoryModule,
    CollectiblesRepositoryModule,
    MessagesRepositoryModule,
    NotificationsRepositoryV2Module,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    TransactionsRepositoryModule,
    QueuesRepositoryModule,
  ],
  providers: [
    { provide: IHooksRepository, useClass: HooksRepositoryWithNotifications },
  ],
  exports: [IHooksRepository],
})
export class HooksRepositoryWithNotificationsModule {}

// TODO: Remove after notifications FF is enables
// Note: trying to convert this into a dynamic module proved to be too complex
// due to config injection issues from the ConfigurationService so this is a
// temporary solution
@Module({
  imports: [
    BalancesRepositoryModule,
    BlockchainRepositoryModule,
    ChainsRepositoryModule,
    CollectiblesRepositoryModule,
    MessagesRepositoryModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    TransactionsRepositoryModule,
    QueuesRepositoryModule,
  ],
  providers: [{ provide: IHooksRepository, useClass: HooksRepository }],
  exports: [IHooksRepository],
})
export class HooksRepositoryModule {}
