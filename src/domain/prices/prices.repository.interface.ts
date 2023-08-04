export const IPricesRepository = Symbol('IPricesRepository');

export interface IPricesRepository {
  // TODO: doc
  getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number>;

  getTokenPrice(args: {
    nativeCoinId: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number>;
}
