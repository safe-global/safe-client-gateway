// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { LruMap } from '#/domain/common/utils/lru-map';

describe('LruMap', () => {
  function getEntries(count: number): Array<[string, number]> {
    return faker.helpers
      .uniqueArray(faker.string.uuid, count)
      .map((key) => [key, faker.number.int()]);
  }

  it('should return the value of a key that was set', () => {
    const [[key, value]] = getEntries(1);
    const map = new LruMap<string, number>(faker.number.int({ min: 1 }));

    map.set(key, value);

    expect(map.get(key)).toBe(value);
  });

  it('should return undefined for a key that was not set', () => {
    const map = new LruMap<string, number>(faker.number.int({ min: 1 }));

    expect(map.get(faker.string.uuid())).toBeUndefined();
  });

  it('should replace the value of a key that is set again', () => {
    const [[key, value]] = getEntries(1);
    const map = new LruMap<string, number>(faker.number.int({ min: 1 }));
    map.set(key, faker.number.int());

    map.set(key, value);

    expect(map.get(key)).toBe(value);
  });

  it('should drop the least recently set entry once full', () => {
    const maxSize = faker.number.int({ min: 1, max: 10 });
    const [oldest, ...others] = getEntries(maxSize + 1);
    const map = new LruMap<string, number>(maxSize);

    for (const [key, value] of [oldest, ...others]) {
      map.set(key, value);
    }

    expect(map.get(oldest[0])).toBeUndefined();
    for (const [key, value] of others) {
      expect(map.get(key)).toBe(value);
    }
  });

  it('should keep an entry that was read over one that was not', () => {
    const maxSize = faker.number.int({ min: 2, max: 10 });
    const [read, unread, ...others] = getEntries(maxSize + 1);
    const map = new LruMap<string, number>(maxSize);
    for (const [key, value] of [read, unread, ...others.slice(0, -1)]) {
      map.set(key, value);
    }

    map.get(read[0]);
    map.set(...others[others.length - 1]);

    expect(map.get(read[0])).toBe(read[1]);
    expect(map.get(unread[0])).toBeUndefined();
  });

  it('should not drop an entry when a key is set again while full', () => {
    const maxSize = faker.number.int({ min: 1, max: 10 });
    const entries = getEntries(maxSize);
    const map = new LruMap<string, number>(maxSize);
    for (const [key, value] of entries) {
      map.set(key, value);
    }

    map.set(...entries[0]);

    for (const [key, value] of entries) {
      expect(map.get(key)).toBe(value);
    }
  });
});
