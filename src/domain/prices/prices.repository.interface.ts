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

  /**
   * Gets the list of supported fiat codes.
   * USD and EUR fiat codes are fixed, and should be the first ones in the result list.
   * @returns ordered list of uppercase strings representing the supported fiat codes.
   */
  getFiatCodes(): Promise<string[]>;
}
