import { HealthEntity } from '@/domain/health/entities/health.entity';
import { IHealthRepository } from '@/domain/health/health.repository.interface';
import {
  CacheReadiness,
  ICacheReadiness,
} from '@/domain/interfaces/cache-readiness.interface';
import {
  IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class HealthRepository implements IHealthRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheReadiness) private readonly cacheService: ICacheReadiness,
    @Inject(QueueReadiness)
    private readonly queuesApi: IQueueReadiness,
  ) {}

  async isReady(): Promise<HealthEntity> {
    try {
      await this.cacheService.ping();
    } catch (error) {
      this.loggingService.warn('Cache service connection is not established');
      return HealthEntity.NOT_READY;
    }

    return this.queuesApi.isReady()
      ? HealthEntity.READY
      : HealthEntity.NOT_READY;
  }
}
