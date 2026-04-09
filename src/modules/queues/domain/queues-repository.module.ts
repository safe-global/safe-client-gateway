// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IQueuesRepository } from '@/modules/queues/domain/queues-repository.interface';
import { QueuesApiModule } from '@/modules/queues/datasources/queues-api.module';
import { QueuesRepository } from '@/modules/queues/domain/queues-repository';

@Module({
  imports: [QueuesApiModule],
  providers: [{ provide: IQueuesRepository, useClass: QueuesRepository }],
  exports: [IQueuesRepository],
})
export class QueuesRepositoryModule {}
