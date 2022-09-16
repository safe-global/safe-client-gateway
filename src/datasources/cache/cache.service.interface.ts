export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  set(
    key: string,
    field: string,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void>;

  get(key: string, field: string): Promise<string | undefined>;

  delete(key: string): Promise<number>;
}
