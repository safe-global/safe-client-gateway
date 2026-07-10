// SPDX-License-Identifier: FSL-1.1-MIT
import { TtlLruCache } from '@/datasources/kms/field-crypto.cache';

describe('TtlLruCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns stored values and misses on unknown keys', () => {
    const cache = new TtlLruCache<string>(2, 1_000);

    cache.set('a', 'plain-a');

    expect(cache.get('a')).toBe('plain-a');
    expect(cache.get('b')).toBeUndefined();
  });

  it('expires entries after the TTL', () => {
    const cache = new TtlLruCache<string>(2, 1_000);
    cache.set('a', 'plain-a');

    vi.advanceTimersByTime(1_001);

    expect(cache.get('a')).toBeUndefined();
  });

  it('evicts the least recently used entry beyond capacity', () => {
    const cache = new TtlLruCache<string>(2, 60_000);
    cache.set('a', 'plain-a');
    cache.set('b', 'plain-b');

    // Touch `a` so `b` is the least recently used.
    cache.get('a');
    cache.set('c', 'plain-c');

    expect(cache.get('a')).toBe('plain-a');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe('plain-c');
  });

  it('overwrites an existing key without growing', () => {
    const cache = new TtlLruCache<string>(2, 60_000);
    cache.set('a', 'plain-a');
    cache.set('b', 'plain-b');

    cache.set('a', 'plain-a2');
    cache.set('c', 'plain-c');

    expect(cache.get('a')).toBe('plain-a2');
    expect(cache.get('b')).toBeUndefined();
  });
});
