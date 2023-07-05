import { Page } from '../entities/page.entity';
import { Chain } from '../chains/entities/chain.entity';
import { SafeApp } from '../safe-apps/entities/safe-app.entity';

export const IConfigApi = Symbol('IConfigApi');

export interface IConfigApi {
  getChains(limit?: number, offset?: number): Promise<Page<Chain>>;

  clearChains(): Promise<void>;

  getChain(chainId: string): Promise<Chain>;

  getSafeApps(
    chainId?: string,
    clientUrl?: string,
    url?: string,
  ): Promise<SafeApp[]>;

  clearSafeApps(): Promise<void>;
}
