import { Inject, Injectable } from '@nestjs/common';
import { HealthEntity } from './entities/health.entity';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';
import { IHealthRepository } from './health.repository.interface';
import {
  CacheReadiness,
  ICacheReadiness,
} from '../interfaces/cache-readiness.interface';

@Injectable()
export class HealthRepository implements IHealthRepository {
  constructor(
    @Inject(CacheReadiness) private readonly cacheService: ICacheReadiness,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  async isReady(): Promise<HealthEntity> {
    try {
      await this.cacheService.ping();
      return HealthEntity.READY;
    } catch (error) {
      this.loggingService.warn('Cache service connection is not established');
      return HealthEntity.NOT_READY;
    }
  }
}
