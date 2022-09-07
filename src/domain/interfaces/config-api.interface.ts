import { Page } from '../entities/page.entity';
import { Chain } from '../chains/entities/chain.entity';

export const IConfigApi = Symbol('IConfigApi');

export interface IConfigApi {
  getChains(limit?: number, offset?: number): Promise<Page<Chain>>;
  getChain(chainId: string): Promise<Chain>;
}
