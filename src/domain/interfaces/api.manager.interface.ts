export interface IApiManager<T> {
  getApi(chainId: string, ...rest: unknown[]): Promise<T>;

  destroyApi(chainId: string): void;
}
