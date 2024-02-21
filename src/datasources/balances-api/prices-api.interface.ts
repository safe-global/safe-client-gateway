import { CoingeckoAssetPrice } from './entities/coingecko-asset-price.entity';

export const IPricesApi = Symbol('IPricesApi');

export interface IPricesApi {
  getNativeCoinPrice(args: {
    chainId: string;
    fiatCode: string;
  }): Promise<number | null>;

  getTokenPrices(args: {
    chainId: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<CoingeckoAssetPrice[]>;

  getFiatCodes(): Promise<string[]>;
}
