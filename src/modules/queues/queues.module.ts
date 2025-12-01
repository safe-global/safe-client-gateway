import { Module } from '@nestjs/common';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { QueuesRepositoryModule } from '@/modules/queues/domain/queues-repository.interface';

@Module({
  imports: [QueuesApiModule, QueuesRepositoryModule],
})
export class QueuesModule {}
