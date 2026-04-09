// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { QueuesRepositoryModule } from '@/modules/queues/domain/queues-repository.module';

@Module({
  imports: [QueuesApiModule, QueuesRepositoryModule],
})
export class QueuesModule {}
