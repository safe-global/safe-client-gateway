import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { BlockchainRepositoryModule } from '@/domain/blockchain/blockchain.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';
import { HooksRepository } from '@/domain/hooks/hooks.repository';
import { MessagesRepositoryModule } from '@/domain/messages/messages.repository.interface';
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
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    TransactionsRepositoryModule,
    QueuesRepositoryModule,
  ],
  providers: [{ provide: IHooksRepository, useClass: HooksRepository }],
  exports: [IHooksRepository],
})
export class HooksRepositoryModule {}
