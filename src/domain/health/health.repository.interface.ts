import { HealthEntity } from './entities/health.entity';

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
