import { Module } from '@nestjs/common';
import { CacheHooksController } from '@/routes/cache-hooks/cache-hooks.controller';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { TransactionsRepositoryModule } from '@/domain/transactions/transactions.repository.interface';
import { MessagesRepositoryModule } from '@/domain/messages/messages.repository.interface';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';
import { QueuesRepositoryModule } from '@/domain/queues/queues-repository.interface';
import { BlockchainRepositoryModule } from '@/domain/blockchain/blockchain.repository.interface';

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
  providers: [CacheHooksService],
  controllers: [CacheHooksController],
})
export class CacheHooksModule {}
