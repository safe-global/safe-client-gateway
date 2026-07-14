// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * Caches API instances per chain.
 *
 * Subclasses define how an instance is built via {@link createApi}.
 * {@link getOrCreateApi} returns the cached instance for a chain, creating
 * and caching it on first use; {@link destroyApi} evicts it so the next
 * retrieval builds a fresh instance (e.g. after a chain update).
 */
export abstract class ChainApiManager<T> {
  private readonly apis: Record<string, T> = {};

  protected abstract createApi(chainId: string): T | Promise<T>;

  protected async getOrCreateApi(chainId: string): Promise<T> {
    this.apis[chainId] ??= await this.createApi(chainId);
    return this.apis[chainId];
  }

  protected hasApi(chainId: string): boolean {
    return this.apis[chainId] !== undefined;
  }

  destroyApi(chainId: string): void {
    if (this.apis[chainId] !== undefined) {
      delete this.apis[chainId];
    }
  }
}
