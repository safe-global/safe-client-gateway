// SPDX-License-Identifier: FSL-1.1-MIT
import { stringifyWithBigInt } from '@/datasources/network/json.helper';

describe('stringifyWithBigInt', () => {
  it('emits BigInt values as raw JSON integers', () => {
    const result = stringifyWithBigInt({ value: 1234567890123456789n });
    expect(result).toBe('{"value":1234567890123456789}');
  });

  it('preserves precision for wei amounts that exceed Number.MAX_SAFE_INTEGER', () => {
    // 1 ETH = 1e18 wei, larger than 2^53 (~9.007e15)
    const oneEthInWei = 10n ** 18n;
    const json = stringifyWithBigInt({ value: oneEthInWei });
    expect(json).toBe('{"value":1000000000000000000}');
    // sanity-check that the JSON parses back losslessly when read as BigInt
    const numericPart = json.match(/:(\d+)/)?.[1];
    expect(BigInt(numericPart as string)).toBe(oneEthInWei);
  });

  it('handles negative BigInt values', () => {
    expect(stringifyWithBigInt({ delta: -42n })).toBe('{"delta":-42}');
  });

  it('handles BigInt nested in arrays and objects', () => {
    expect(
      stringifyWithBigInt({
        amounts: [1n, 2n, 3n],
        nested: { fee: 1000000000000n },
      }),
    ).toBe('{"amounts":[1,2,3],"nested":{"fee":1000000000000}}');
  });

  it('leaves regular numbers, strings, and booleans untouched', () => {
    expect(stringifyWithBigInt({ a: 1, b: 'hello', c: true, d: null })).toBe(
      '{"a":1,"b":"hello","c":true,"d":null}',
    );
  });

  it('does not mangle string values that happen to contain digit sequences', () => {
    expect(stringifyWithBigInt({ id: '1234567890' })).toBe(
      '{"id":"1234567890"}',
    );
  });
});
