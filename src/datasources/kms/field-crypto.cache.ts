// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * A minimal TTL'd LRU for decrypted field values, keyed by ciphertext.
 *
 * Ciphertext → plaintext is an immutable mapping (a changed value is a new
 * ciphertext, hence a new key), so entries never need invalidation — they
 * only age out. Values are plaintext and must therefore stay in process
 * memory: never back this with Redis or any external store.
 */
export class TtlLruCache<T> {
  /** Map iteration order doubles as recency order (oldest first). */
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly maxEntries: number,
    private readonly ttlMs: number,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert to mark as most recently used.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    if (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) {
        this.entries.delete(oldest);
      }
    }
  }
}
