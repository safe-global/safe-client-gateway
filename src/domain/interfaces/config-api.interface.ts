import { Chain } from '@/domain/chains/entities/chain.entity';
import { Page } from '@/domain/entities/page.entity';
import { SafeApp } from '@/domain/safe-apps/entities/safe-app.entity';

export const IConfigApi = Symbol('IConfigApi');

export interface IConfigApi {
  getChains(args: { limit?: number; offset?: number }): Promise<Page<Chain>>;

  getChain(chainId: string): Promise<Chain>;

  clearChain(chainId: string): Promise<void>;

  getSafeApps(args: {
    chainId?: string;
    clientUrl?: string;
    onlyListed?: boolean;
    url?: string;
  }): Promise<SafeApp[]>;

  clearSafeApps(chainId: string): Promise<void>;
}
