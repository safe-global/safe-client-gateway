import { AssetPrice } from '../prices/entities/asset-price.entity';

export const IPricesApi = Symbol('IPricesApi');

export interface IPricesApi {
  getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<AssetPrice>;

  getTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<AssetPrice>;

  getFiatCodes(): Promise<string[]>;

  /**
   * Registers a price reference for token address as not-found.
   * This function allows the clients of this interface to signal that a price couldn't
   * be parsed from its {@link AssetPrice}. This allows the underlying implementation
   * to delay subsequent requests targeting the same token address.
   */
  registerNotFoundTokenPrice(args: {
    chainName: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<void>;
}
