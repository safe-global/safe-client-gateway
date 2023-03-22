import { Inject, Injectable } from '@nestjs/common';
import { FlushRepository } from '../../domain/flush/flush.repository';
import { IFlushRepository } from '../../domain/flush/flush.repository.interface';
import { InvalidationPatternDto } from './entities/invalidation-pattern.dto.entity';

@Injectable()
export class FlushService {
  constructor(
    @Inject(IFlushRepository)
    private readonly flushRepository: FlushRepository,
  ) {}

  async flush(pattern: InvalidationPatternDto): Promise<void> {
    await this.flushRepository.execute(pattern);
  }
}
