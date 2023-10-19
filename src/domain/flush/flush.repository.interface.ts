import { InvalidationPatternDto } from '@/domain/flush/entities/invalidation-pattern.dto.entity';

export const IFlushRepository = Symbol('IFlushRepository');

export interface IFlushRepository {
  /**
   * Invalidates cache data for the given {@link InvalidationPatternDto}
   *
   * @param pattern {@link InvalidationPatternDto} to invalidate.
   */
  execute(pattern: InvalidationPatternDto): Promise<void>;
}
