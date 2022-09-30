import { Backbone } from '../backbone/entities/backbone.entity';
import { Balance } from '../balances/entities/balance.entity';
import { Page } from '../entities/page.entity';
import { Collectible } from '../collectibles/entities/collectible.entity';
import { MasterCopy } from '../chains/entities/master-copies.entity';

export interface ITransactionApi {
  getBalances(
    safeAddress: string,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Balance[]>;

  clearLocalBalances(safeAddress: string): Promise<void>;

  getCollectibles(
    safeAddress: string,
    limit?: number,
    offset?: number,
    trusted?: boolean,
    excludeSpam?: boolean,
  ): Promise<Page<Collectible>>;

  getBackbone(): Promise<Backbone>;

  getMasterCopies(): Promise<MasterCopy[]>;
}
