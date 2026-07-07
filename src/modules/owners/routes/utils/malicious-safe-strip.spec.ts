// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { unionStrip } from '@/modules/owners/routes/utils/malicious-safe-strip';

const lowerAddress = (): string =>
  faker.finance.ethereumAddress().toLowerCase();

describe('unionStrip', () => {
  it('returns all addresses unchanged when nothing is stripped', () => {
    const a = lowerAddress();
    const b = lowerAddress();

    expect(unionStrip([a, b], new Set())).toEqual([a, b]);
  });

  it('strips set members case-insensitively even when the input is checksummed', () => {
    const a = lowerAddress();
    const b = lowerAddress();
    const checksummed = getAddress(a);
    expect(checksummed).not.toBe(a);

    const result = unionStrip([checksummed, b], new Set([a]));

    expect(result).toEqual([b]);
  });

  it('keeps non-stripped addresses byte-for-byte and preserves order', () => {
    const a = lowerAddress();
    const b = lowerAddress();
    const checksummedC = getAddress(lowerAddress());

    const result = unionStrip([a, b, checksummedC], new Set([b]));

    expect(result).toEqual([a, checksummedC]);
  });

  it('returns an empty array when every address is stripped', () => {
    const a = lowerAddress();
    const b = lowerAddress();

    expect(unionStrip([a, b], new Set([a, b]))).toEqual([]);
  });
});
