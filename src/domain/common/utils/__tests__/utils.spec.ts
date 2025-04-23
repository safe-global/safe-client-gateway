import { sortObject } from '@/domain/common/utils/utils';

describe('sortObject', () => {
  it('should return primitive values as-is', () => {
    expect(sortObject(null)).toBe(null);
    expect(sortObject(undefined)).toBe(undefined);
    expect(sortObject(42)).toBe(42);
    expect(sortObject('hello')).toBe('hello');
    expect(sortObject(true)).toBe(true);
  });

  it('should handle empty objects and arrays', () => {
    expect(sortObject({})).toEqual({});
    expect(sortObject([])).toEqual([]);
  });

  it('should sort arrays containing primitives and objects', () => {
    const input = [3, { b: 2, a: 1 }, 1];

    const result = sortObject(input);

    expect(result).toEqual([3, { a: 1, b: 2 }, 1]);
  });

  it('should recursively sort arrays of objects', () => {
    const input = [
      { b: 2, a: 1 },
      { d: 4, c: 3 },
    ];

    const result = sortObject(input);

    expect(result).toEqual([
      { a: 1, b: 2 },
      { c: 3, d: 4 },
    ]);
  });

  it('should sort object keys alphabetically', () => {
    const input = { b: 2, a: 1, c: 3 };

    const result = sortObject(input);

    expect(result).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('should sort nested objects', () => {
    const input = { b: { d: 4, c: 3 }, a: 1 };

    const result = sortObject(input);

    expect(result).toEqual({ a: 1, b: { c: 3, d: 4 } });
  });

  it('should sort mixed type object values', () => {
    const input = {
      z: 1,
      a: [1, { b: 2, a: 1 }],
      m: { c: 3, b: 2 },
    };

    const result = sortObject(input);

    expect(result).toEqual({
      a: [1, { a: 1, b: 2 }],
      m: { b: 2, c: 3 },
      z: 1,
    });
  });

  it('should sort deeply nested structures', () => {
    const input = {
      b: {
        d: [
          { z: 26, y: 25 },
          { b: 2, a: 1 },
        ],
        c: 3,
      },
      a: 1,
    };

    const result = sortObject(input);

    expect(result).toEqual({
      a: 1,
      b: {
        c: 3,
        d: [
          { y: 25, z: 26 },
          { a: 1, b: 2 },
        ],
      },
    });
  });

  it('should not mutate the original object', () => {
    const input = { b: 2, a: 1 };
    const inputCopy = structuredClone(input);

    sortObject(input);

    expect(input).toEqual(inputCopy);
  });
});
