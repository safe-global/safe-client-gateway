import { Inject, Injectable } from '@nestjs/common';
import { HealthEntity } from '@/domain/health/entities/health.entity';
import { IHealthRepository } from '@/domain/health/health.repository.interface';
import {
  CacheReadiness,
  ICacheReadiness,
} from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  IQueueReadiness,
  QueueReadiness,
} from '@/domain/interfaces/queue-readiness.interface';

@Injectable()
export class HealthRepository implements IHealthRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheReadiness) private readonly cacheService: ICacheReadiness,
    @Inject(QueueReadiness) private readonly queuesApi: IQueueReadiness,
  ) {}

  async isReady(): Promise<HealthEntity> {
    try {
      await this.cacheService.ping();
    } catch (error) {
      this.loggingService.warn('Cache service connection is not established');
      return HealthEntity.NOT_READY;
    }

    if (!this.queuesApi.isReady()) {
      this.loggingService.warn('AMQP connection is not established');
      return HealthEntity.NOT_READY;
    }

    return HealthEntity.READY;
  }
}
