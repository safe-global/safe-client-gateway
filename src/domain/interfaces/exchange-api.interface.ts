export const IExchangeApi = Symbol('IExchangeApi');

export interface IExchangeApi {
  convertRates(to: string, from: string): Promise<number>;
  getFiatCodes(): Promise<string[]>;
}
