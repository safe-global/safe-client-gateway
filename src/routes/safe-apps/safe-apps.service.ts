import { Inject, Injectable } from '@nestjs/common';
import { SafeAppsRepository } from '../../domain/safe-apps/safe-apps.repository';
import { ISafeAppsRepository } from '../../domain/safe-apps/safe-apps.repository.interface';
import { SafeApp } from './entities/safe-app.entity';

@Injectable()
export class SafeAppsService {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
  ) {}

  async getSafeApps(
    chainId: string,
    clientUrl?: string,
    url?: string,
  ): Promise<SafeApp[]> {
    const result = await this.safeAppsRepository.getSafeApps(
      chainId,
      clientUrl,
      url,
    );
    return result.map(
      (safeApp) =>
        new SafeApp(
          safeApp.id,
          safeApp.url,
          safeApp.name,
          safeApp.iconUrl,
          safeApp.description,
          safeApp.chainIds.map((chainId) => chainId.toString()),
          safeApp.provider,
          safeApp.accessControl,
          safeApp.tags,
          safeApp.features,
          safeApp.developerWebsite,
          safeApp.socialProfiles,
        ),
    );
  }
}
