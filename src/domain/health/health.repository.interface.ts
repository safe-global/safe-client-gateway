import { HealthEntity } from '@/domain/health/entities/health.entity';
import { Module } from '@nestjs/common';
import { HealthRepository } from '@/domain/health/health.repository';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';

export const IHealthRepository = Symbol('IHealthRepository');

export interface IHealthRepository {
  /**
   * Checks if the service is considered to be in a ready state.
   *
   * Some conditions might be required to consider the service to be ready
   * (Redis connection established, for example).
   *
   * Returns {@link HealthEntity.READY} if the service is ready. Else
   * returns {@link HealthEntity.NOT_READY}
   */
  isReady(): Promise<HealthEntity>;
}

@Module({
  imports: [QueuesApiModule],
  providers: [
    {
      provide: IHealthRepository,
      useClass: HealthRepository,
    },
  ],
  exports: [IHealthRepository],
})
export class HealthRepositoryModule {}
