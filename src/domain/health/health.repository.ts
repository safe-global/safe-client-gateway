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
import { HealthCheckError } from '@/domain/health/entities/healthError.entity';

@Injectable()
export class HealthRepository implements IHealthRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheReadiness) private readonly cacheService: ICacheReadiness,
    @Inject(QueueReadiness) private readonly queuesApi: IQueueReadiness,
  ) {}

  async isAlive(): Promise<HealthEntity> {
    try {
      this.isAmqpHealthy();
      await this.isRedisHealthy();

      return HealthEntity.READY;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        this.loggingService.warn(error.message);
      }

      return HealthEntity.NOT_READY;
    }
  }

  async isReady(): Promise<HealthEntity> {
    try {
      this.isAmqpHealthy();
      await this.isRedisHealthy();

      return HealthEntity.READY;
    } catch (error) {
      if (error instanceof HealthCheckError) {
        this.loggingService.warn(error.message);
      }

      return HealthEntity.NOT_READY;
    }
  }

  async isRedisHealthy(): Promise<boolean> {
    try {
      await this.cacheService.ping();

      return true;
    } catch {
      throw new HealthCheckError('Cache service connection is not established');
    }
  }

  isAmqpHealthy(): boolean {
    if (!this.queuesApi.isReady()) {
      throw new HealthCheckError('AMQP connection is not established');
    }

    return true;
  }
}
