import { Inject, Injectable } from '@nestjs/common';
import { SafeAppAccessControlPolicies } from '@/modules/safe-apps/domain/entities/safe-app-access-control.entity';
import { SafeApp as DomainSafeApp } from '@/modules/safe-apps/domain/entities/safe-app.entity';
import { SafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository';
import { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeApp } from '@/modules/safe-apps/routes/entities/safe-app.entity';
import { SafeAppAccessControl } from '@/modules/safe-apps/routes/entities/safe-app-access-control.entity';

@Injectable()
export class SafeAppsService {
  constructor(
    @Inject(ISafeAppsRepository)
    private readonly safeAppsRepository: SafeAppsRepository,
  ) {}

  async getSafeApps(args: {
    chainId: string;
    clientUrl?: string;
    url?: string;
  }): Promise<Array<SafeApp>> {
    const result = await this.safeAppsRepository.getSafeApps({
      ...args,
      onlyListed: true,
    });

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
          this._parseAccessControl(safeApp),
          safeApp.tags,
          safeApp.features,
          safeApp.developerWebsite,
          safeApp.socialProfiles,
          safeApp.featured,
        ),
    );
  }

  private _parseAccessControl(
    domainSafeApp: DomainSafeApp,
  ): SafeAppAccessControl {
    switch (domainSafeApp.accessControl.type) {
      case SafeAppAccessControlPolicies.NoRestrictions:
        return {
          type: SafeAppAccessControlPolicies.NoRestrictions,
          value: null,
        };
      case SafeAppAccessControlPolicies.DomainAllowlist:
        return {
          type: SafeAppAccessControlPolicies.DomainAllowlist,
          value: domainSafeApp.accessControl.value,
        };
      default:
        return {
          type: SafeAppAccessControlPolicies.Unknown,
          value: null,
        };
    }
  }
}
