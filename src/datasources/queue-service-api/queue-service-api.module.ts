// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IQueueServiceApi } from '@/datasources/queue-service-api/queue-service-api.interface';
import { QueueServiceApi } from '@/datasources/queue-service-api/queue-service-api.service';
import { QueueServiceErrorMapper } from '@/datasources/queue-service-api/mappers/queue-error.mapper';

@Module({
  providers: [
    QueueServiceErrorMapper,
    { provide: IQueueServiceApi, useClass: QueueServiceApi },
  ],
  exports: [IQueueServiceApi],
})
export class QueueServiceApiModule {}
