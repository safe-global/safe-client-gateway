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
  private readonly apis: Record<string, Promise<T>> = {};

  protected abstract createApi(chainId: string): T | Promise<T>;

  protected getOrCreateApi(chainId: string): Promise<T> {
    const cached = this.apis[chainId];
    if (cached !== undefined) {
      return cached;
    }

    // Cache the pending promise so concurrent retrievals share one creation.
    // Deferring via Promise.resolve().then() turns a synchronous createApi
    // throw into a rejection instead of letting it escape the caller.
    const created = Promise.resolve()
      .then(() => this.createApi(chainId))
      .catch((error) => {
        // Do not cache failures; let the next retrieval retry.
        // Only evict the entry this creation cached, in case it was
        // already replaced.
        if (this.apis[chainId] === created) {
          delete this.apis[chainId];
        }
        throw error;
      });
    this.apis[chainId] = created;

    return created;
  }

  protected hasApi(chainId: string): boolean {
    return this.apis[chainId] !== undefined;
  }

  destroyApi(chainId: string): void {
    delete this.apis[chainId];
  }
}
