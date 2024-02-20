import { CoingeckoAssetPrice } from './entities/coingecko-asset-price.entity';

export const ICoingeckoApi = Symbol('ICoingeckoApi');

export interface ICoingeckoApi {
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
