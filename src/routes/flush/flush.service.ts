import { Inject, Injectable } from '@nestjs/common';
import {
  InvalidationPatternDetails,
  InvalidationPatternDto as DomainInvalidationPatternDto,
} from '@/domain/flush/entities/invalidation-pattern.dto.entity';
import { FlushRepository } from '@/domain/flush/flush.repository';
import { IFlushRepository } from '@/domain/flush/flush.repository.interface';
import { InvalidationPatternDto } from '@/routes/flush/entities/invalidation-pattern.dto.entity';

@Injectable()
export class FlushService {
  constructor(
    @Inject(IFlushRepository)
    private readonly flushRepository: FlushRepository,
  ) {}

  async flush(pattern: InvalidationPatternDto): Promise<void> {
    const patternDetails = pattern.patternDetails
      ? new InvalidationPatternDetails(pattern.patternDetails.chain_id)
      : null;

    const invalidationPattern = new DomainInvalidationPatternDto(
      pattern.invalidate,
      patternDetails,
    );

    await this.flushRepository.execute(invalidationPattern);
  }
}
