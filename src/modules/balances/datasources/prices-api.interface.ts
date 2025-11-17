import type { AssetPrice } from '@/modules/balances/datasources/entities/asset-price.entity';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { Raw } from '@/validation/entities/raw.entity';

export const IPricesApi = Symbol('IPricesApi');

export interface IPricesApi {
  getNativeCoinPrice(args: {
    chain: Chain;
    fiatCode: string;
  }): Promise<AssetPrice[string] | null>;

  getTokenPrices(args: {
    chain: Chain;
    tokenAddresses: Array<string>;
    fiatCode: string;
  }): Promise<Raw<Array<AssetPrice>>>;

  getFiatCodes(): Promise<Raw<Array<string>>>;
}
