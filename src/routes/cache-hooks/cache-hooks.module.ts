import { Module } from '@nestjs/common';
import { JsonSchemaService } from '@/validation/providers/json-schema.service';
import { CacheHooksController } from '@/routes/cache-hooks/cache-hooks.controller';
import { CacheHooksService } from '@/routes/cache-hooks/cache-hooks.service';
import { BalancesRepositoryModule } from '@/domain/balances/balances.repository.interface';
import { CollectiblesRepositoryModule } from '@/domain/collectibles/collectibles.repository.interface';
import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { MessagesRepositoryModule } from '@/domain/messages/messages.repository.interface';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';
import { QueueConsumerModule } from '@/datasources/queues/queue-consumer.module';

@Module({
  imports: [
    BalancesRepositoryModule,
    ChainsRepositoryModule,
    CollectiblesRepositoryModule,
    MessagesRepositoryModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    QueueConsumerModule.register(),
  ],
  providers: [JsonSchemaService, CacheHooksService],
  controllers: [CacheHooksController],
})
export class CacheHooksModule {}
