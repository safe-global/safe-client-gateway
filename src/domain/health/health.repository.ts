import { Inject, Injectable } from '@nestjs/common';
import { HealthEntity } from '@/domain/health/entities/health.entity';
import { IHealthRepository } from '@/domain/health/health.repository.interface';
import {
  CacheReadiness,
  ICacheReadiness,
} from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { IQueuesApiService } from '@/datasources/queues/queues-api.service.interface';

@Injectable()
export class HealthRepository implements IHealthRepository {
  constructor(
    @Inject(CacheReadiness) private readonly cacheService: ICacheReadiness,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IQueuesApiService)
    private readonly queuesApiService: IQueuesApiService,
  ) {}

  async isReady(): Promise<HealthEntity> {
    try {
      await this.cacheService.ping();
    } catch (error) {
      this.loggingService.warn('Cache service connection is not established');
      return HealthEntity.NOT_READY;
    }

    return this.queuesApiService.isReady()
      ? HealthEntity.READY
      : HealthEntity.NOT_READY;
  }
}
