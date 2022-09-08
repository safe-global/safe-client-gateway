export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  set(key: string, value: string, expireTimeSeconds?: number): Promise<void>;
  get<T>(key: string): Promise<T>;
}
