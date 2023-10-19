import { Inject, Injectable } from '@nestjs/common';
import { InvalidationPatternDto } from '@/domain/flush/entities/invalidation-pattern.dto.entity';
import { InvalidationTarget } from '@/domain/flush/entities/invalidation-target.entity';
import { IFlushRepository } from '@/domain/flush/flush.repository.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';

@Injectable()
export class FlushRepository implements IFlushRepository {
  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigApi) private readonly configApi: IConfigApi,
  ) {}

  async execute(pattern: InvalidationPatternDto): Promise<void> {
    switch (pattern.invalidate) {
      case InvalidationTarget[InvalidationTarget.Chains]:
        await Promise.all([
          this.configApi.clearChains(),
          this.configApi.clearSafeApps(),
        ]);
        break;
      default:
        this.loggingService.warn(`Unknown flush pattern ${pattern.invalidate}`);
    }
  }
}
