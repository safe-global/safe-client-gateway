export const IExchangeRepository = Symbol('IExchangeRepository');

export interface IExchangeRepository {
  /**
   * Gets the conversion rate between the currencies {@link to} and {@link from}
   */
  convertRates(args: { to: string; from: string }): Promise<number>;

  /**
   * Gets the available fiat codes
   */
  getFiatCodes(): Promise<string[]>;
}
