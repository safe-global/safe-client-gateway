import { SafeApp } from './entities/safe-app.entity';

export const ISafeAppsRepository = Symbol('ISafeAppsRepository');

export interface ISafeAppsRepository {
  /**
   * Gets the {@link SafeApp[]} associated with the {@link chainId}.
   *
   * @param chainId filters Safe Apps that are available on that chain.
   * @param clientUrl filters Safe Apps that are available on that clientUrl.
   * @param url filters Safe Apps available from that url. It needs to be an exact match.
   */
  getSafeApps(
    chainId: string,
    clientUrl?: string,
    url?: string,
  ): Promise<SafeApp[]>;
}
