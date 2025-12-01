export const ITransactionsRepository = Symbol('ITransactionsRepository');

export interface ITransactionsRepository {
  clearApi(chainId: string): void;
}
