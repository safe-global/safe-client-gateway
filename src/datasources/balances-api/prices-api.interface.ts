import { AssetPrice } from '@/datasources/balances-api/entities/asset-price.entity';
import { Chain } from '@/domain/chains/entities/chain.entity';

export const IPricesApi = Symbol('IPricesApi');

export interface IPricesApi {
  getNativeCoinPrice(args: {
    chain: Chain;
    fiatCode: string;
  }): Promise<number | null>;

  getTokenPrices(args: {
    chain: Chain;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]>;

  getFiatCodes(): Promise<string[]>;
}
