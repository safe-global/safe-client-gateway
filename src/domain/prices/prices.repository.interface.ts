import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';

export const IPricesRepository = Symbol('IPricesRepository');

export interface IPricesRepository {
  getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number>;

  getTokenPrices(args: {
    chainName: string;
    tokenAddresses: string[];
    fiatCode: string;
  }): Promise<AssetPrice[]>;

  getFiatCodes(): Promise<string[]>;
}
