// SPDX-License-Identifier: FSL-1.1-MIT

/**
 * A map that holds at most `maxSize` entries. Once it is full, setting a new
 * key drops the least recently used entry.
 */
export class LruMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) {
      return undefined;
    }

    // A Map iterates in insertion order, so re-inserting marks the entry as
    // the most recently used one
    this.entries.delete(key);
    this.entries.set(key, value);

    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);

    if (this.entries.size >= this.maxSize) {
      const [leastRecentlyUsed] = this.entries.keys();
      this.entries.delete(leastRecentlyUsed);
    }

    this.entries.set(key, value);
  }
}
