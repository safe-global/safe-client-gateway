import { getFirstAvailable } from '../array';

describe('getFirstAvailable()', () => {
  it('Should return the first available value from the given paths', () => {
    const sourceObject = { a: 1, b: 2, c: 3 };
    const paths = ['b', 'c', 'a'];

    const result = getFirstAvailable(sourceObject, paths);

    expect(result).toBe(sourceObject.b);
  });

  it('Should return undefined if none of the paths exist in the source object', () => {
    const sourceObject = { a: 1, b: 2 };
    const paths = ['c', 'd'];

    const result = getFirstAvailable(sourceObject, paths);

    expect(result).toBeUndefined();
  });

  it('Should return undefined if the paths array is empty', () => {
    const sourceObject = { a: 1, b: 2 };
    const paths: Array<string> = [];

    const result = getFirstAvailable(sourceObject, paths);

    expect(result).toBeUndefined();
  });

  it('Should handle nested paths correctly', () => {
    const sourceObject = { a: { b: { c: 42 } } };
    const paths = ['a.b.c', 'a.b', 'a'];

    const result = getFirstAvailable(sourceObject, paths);

    expect(result).toBe(sourceObject.a.b.c);
  });

  it('Should return undefined if the source object is empty', () => {
    const sourceObject = {};
    const paths = ['a', 'b'];
    const result = getFirstAvailable(sourceObject, paths);
    expect(result).toBeUndefined();
  });

  it('Should return the first non-undefined value even if it is falsy', () => {
    const sourceObject = { a: undefined, b: 0, c: false };
    const paths = ['a', 'b', 'c'];
    const result = getFirstAvailable(sourceObject, paths);
    expect(result).toBe(0);
  });
});
