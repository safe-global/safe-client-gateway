import {
  areSimilarAddresses,
  findSimilarAddressPairs,
} from '@/modules/owners/routes/utils/address-poisoning';

describe('areSimilarAddresses', () => {
  it('should return false for identical addresses', () => {
    const address = '0x1234567890abcdef1234567890abcdef12345678';
    expect(areSimilarAddresses(address, address)).toBe(false);
  });

  it('should return true for addresses with same prefix and suffix but different middle', () => {
    const a = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd';
    const b = '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbabcd';
    expect(areSimilarAddresses(a, b)).toBe(true);
  });

  it('should return false for addresses with same prefix but different suffix', () => {
    const a = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd';
    const b = '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1111';
    expect(areSimilarAddresses(a, b)).toBe(false);
  });

  it('should return false for addresses with different prefix but same suffix', () => {
    const a = '0x1111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd';
    const b = '0x2222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbabcd';
    expect(areSimilarAddresses(a, b)).toBe(false);
  });

  it('should be case insensitive', () => {
    const a = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaABCD';
    const b = '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbabcd';
    expect(areSimilarAddresses(a, b)).toBe(true);
  });

  it('should return false for completely different addresses', () => {
    const a = '0xaaaa111111111111111111111111111111112222';
    const b = '0xbbbb333333333333333333333333333333334444';
    expect(areSimilarAddresses(a, b)).toBe(false);
  });
});

describe('findSimilarAddressPairs', () => {
  it('should return empty array for empty input', () => {
    expect(findSimilarAddressPairs([])).toEqual([]);
  });

  it('should return empty array for single address', () => {
    expect(
      findSimilarAddressPairs(['0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd']),
    ).toEqual([]);
  });

  it('should return empty array for two non-similar addresses', () => {
    expect(
      findSimilarAddressPairs([
        '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd',
        '0x5678bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb1234',
      ]),
    ).toEqual([]);
  });

  it('should find a pair of similar addresses', () => {
    const addresses = [
      '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd',
      '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbabcd',
    ];
    expect(findSimilarAddressPairs(addresses)).toEqual([[0, 1]]);
  });

  it('should find multiple pairs among several addresses', () => {
    const addresses = [
      '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd', // similar to [1]
      '0x1234bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbabcd', // similar to [0]
      '0x5678ccccccccccccccccccccccccccccccccef01', // similar to [3]
      '0x5678ddddddddddddddddddddddddddddddddef01', // similar to [2]
    ];
    expect(findSimilarAddressPairs(addresses)).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('should not pair identical addresses', () => {
    const address = '0x1234aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaabcd';
    expect(findSimilarAddressPairs([address, address])).toEqual([]);
  });
});
