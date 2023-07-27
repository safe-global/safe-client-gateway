export const CacheReadiness = Symbol('ICacheReadiness');

export interface ICacheReadiness {
  /**
   * Pings the current cache instance being used. If no connection was
   * established before, the promise rejects.
   */
  ping(): Promise<unknown>;
}
