import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HealthEntity } from '@/modules/health/domain/entities/health.entity';
import { IHealthRepository } from '@/modules/health/domain/health.repository.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import {
  Health,
  HealthStatus,
} from '@/modules/health/routes/entities/health.entity';

@Injectable()
export class HealthService {
  constructor(
    @Inject(IHealthRepository)
    private readonly healthRepository: IHealthRepository,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {}

  async isReady(): Promise<Health> {
    return this.handleHealthCheckError(await this.healthRepository.isReady());
  }

  async isAlive(): Promise<Health> {
    return this.handleHealthCheckError(await this.healthRepository.isAlive());
  }

  handleHealthCheckError(healthMetric: HealthEntity): Health {
    switch (healthMetric) {
      case HealthEntity.READY:
        return new Health(HealthStatus.OK);
      case HealthEntity.NOT_READY:
        throw new ServiceUnavailableException(new Health(HealthStatus.KO));
      default:
        this.loggingService.error(
          `Readiness status ${healthMetric} not handled`,
        );
        return new Health(HealthStatus.KO);
    }
  }
}
