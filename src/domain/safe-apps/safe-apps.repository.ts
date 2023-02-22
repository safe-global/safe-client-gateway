import { Inject, Injectable } from '@nestjs/common';
import { IConfigApi } from '../interfaces/config-api.interface';
import { SafeApp } from './entities/safe-app.entity';
import { ISafeAppsRepository } from './safe-apps.repository.interface';
import { SafeAppsValidator } from './safe-apps.validator';

@Injectable()
export class SafeAppsRepository implements ISafeAppsRepository {
  constructor(
    @Inject(IConfigApi)
    private readonly configApi: IConfigApi,
    private readonly validator: SafeAppsValidator,
  ) {}

  async getSafeApps(
    chainId?: string,
    clientUrl?: string,
    url?: string,
  ): Promise<SafeApp[]> {
    const safeApps = await this.configApi.getSafeApps(chainId, clientUrl, url);
    return safeApps.map((safeApp) => this.validator.validate(safeApp));
  }

  async getSafeAppById(chainId: string, id: number): Promise<SafeApp | null> {
    const safeApps = await this.configApi.getSafeApps(chainId);
    const safeApp = safeApps.find((safeApp) => safeApp.id === id);
    return safeApp ? this.validator.validate(safeApp) : null;
  }
}
