import { SafeApp } from './entities/safe-app.entity';

export const ISafeAppsRepository = Symbol('ISafeAppsRepository');

export interface ISafeAppsRepository {
  /**
   * Gets the {@link SafeApp[]} associated with the {@link chainId}.
   *
   * @param chainId
   */
  getSafeApps(chainId: string): Promise<SafeApp[]>;
}
