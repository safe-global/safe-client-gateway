export const IPricesRepository = Symbol('IPricesRepository');

export interface IPricesRepository {
  getNativeCoinPrice(args: {
    nativeCoinId: string;
    fiatCode: string;
  }): Promise<number | null>;

  getTokenPrice(args: {
    nativeCoinId: string;
    tokenAddress: string;
    fiatCode: string;
  }): Promise<number | null>;
}
