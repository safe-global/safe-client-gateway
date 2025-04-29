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
  public constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(CacheReadiness) private readonly cacheService: ICacheReadiness,
    @Inject(QueueReadiness) private readonly queuesApi: IQueueReadiness,
  ) {}

  public async isAlive(): Promise<HealthEntity> {
    try {
      await this.checkMainServicesStatus();

      return HealthEntity.READY;
    } catch (error) {
      this.logHealthCheckError(error);

      return HealthEntity.NOT_READY;
    }
  }

  public async isReady(): Promise<HealthEntity> {
    try {
      await this.checkMainServicesStatus();

      return HealthEntity.READY;
    } catch (error) {
      this.logHealthCheckError(error);

      return HealthEntity.NOT_READY;
    }
  }

  private async checkMainServicesStatus(): Promise<boolean> {
    this.isAmqpHealthy();
    await this.isRedisHealthy();

    return true;
  }

  private async isRedisHealthy(): Promise<boolean> {
    try {
      await this.cacheService.ping();

      return true;
    } catch {
      throw new HealthCheckError('Cache service connection is not established');
    }
  }

  private isAmqpHealthy(): boolean {
    if (!this.queuesApi.isReady()) {
      throw new HealthCheckError('AMQP connection is not established');
    }

    return true;
  }

  private logHealthCheckError(error: unknown): void {
    if (error instanceof HealthCheckError) {
      this.loggingService.error(error.message);
    }
  }
}
