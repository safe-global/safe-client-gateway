import { Inject, Injectable } from '@nestjs/common';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { SafeApp } from '@/domain/safe-apps/entities/safe-app.entity';
import { ISafeAppsRepository } from '@/domain/safe-apps/safe-apps.repository.interface';
import { SafeAppSchema } from '@/domain/safe-apps/entities/schemas/safe-app.schema';

@Injectable()
export class SafeAppsRepository implements ISafeAppsRepository {
  constructor(
    @Inject(IConfigApi)
    private readonly configApi: IConfigApi,
  ) {}

  async getSafeApps(args: {
    chainId?: string;
    clientUrl?: string;
    ignoreVisibility?: boolean;
    url?: string;
  }): Promise<SafeApp[]> {
    const safeApps = await this.configApi.getSafeApps(args);
    return safeApps.map((safeApp) => SafeAppSchema.parse(safeApp));
  }

  async clearSafeApps(chainId: string): Promise<void> {
    return this.configApi.clearSafeApps(chainId);
  }

  async getSafeAppById(chainId: string, id: number): Promise<SafeApp | null> {
    const safeApps = await this.configApi.getSafeApps({ chainId });
    const safeApp = safeApps.find((safeApp) => safeApp.id === id);
    return safeApp ? SafeAppSchema.parse(safeApp) : null;
  }
}
