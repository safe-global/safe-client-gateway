import { Inject, Injectable } from '@nestjs/common';
import { SafeApp } from '../../domain/safe-apps/entities/safe-app.entity';
import { SafeAppsRepository } from '../../domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '../../domain/safe-apps/safe-apps.repository.interface';

@Injectable()
export class SafeAppsService {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
  ) {}

  async getSafeApps(chainId: string): Promise<SafeApp[]> {
    return this.safeAppsRepository.getSafeApps(chainId);
  }
}
