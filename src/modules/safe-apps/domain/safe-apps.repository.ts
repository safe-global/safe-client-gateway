import { Inject, Injectable } from '@nestjs/common';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { type SafeApp } from '@/modules/safe-apps/domain/entities/safe-app.entity';
import { ISafeAppsRepository } from '@/modules/safe-apps/domain/safe-apps.repository.interface';
import { SafeAppsSchema } from '@/modules/safe-apps/domain/entities/schemas/safe-app.schema';

@Injectable()
export class SafeAppsRepository implements ISafeAppsRepository {
  constructor(
    @Inject(IConfigApi)
    private readonly configApi: IConfigApi,
  ) {}

  async getSafeApps(args: {
    chainId?: string;
    clientUrl?: string;
    onlyListed?: boolean;
    url?: string;
  }): Promise<Array<SafeApp>> {
    const safeApps = await this.configApi.getSafeApps(args);
    return SafeAppsSchema.parse(safeApps);
  }

  async clearSafeApps(chainId: string): Promise<void> {
    return this.configApi.clearSafeApps(chainId);
  }

  async getSafeAppById(chainId: string, id: number): Promise<SafeApp | null> {
    const safeApps = await this.configApi
      .getSafeApps({ chainId })
      .then(SafeAppsSchema.parse);
    const safeApp = safeApps.find((safeApp) => safeApp.id === id);
    return safeApp ?? null;
  }
}
