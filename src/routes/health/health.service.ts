import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { IHealthRepository } from '../../domain/health/health.repository.interface';
import { HealthEntity } from '../../domain/health/entities/health.entity';
import { Health, HealthStatus } from './entities/health.entity';
import {
  ILoggingService,
  LoggingService,
} from '../../logging/logging.interface';

@Injectable()
export class HealthService {
  constructor(
    @Inject(IHealthRepository)
    private readonly healthRepository: IHealthRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async isReady(): Promise<Health> {
    const readiness = await this.healthRepository.isReady();
    switch (readiness) {
      case HealthEntity.READY:
        return new Health(HealthStatus.OK);
      case HealthEntity.NOT_READY:
        throw new ServiceUnavailableException(new Health(HealthStatus.KO));
      default:
        this.loggingService.error(`Readiness status ${readiness} not handled`);
        return new Health(HealthStatus.KO);
    }
  }
}
