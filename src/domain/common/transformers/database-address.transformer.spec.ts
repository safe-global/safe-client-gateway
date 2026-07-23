// SPDX-License-Identifier: FSL-1.1-MIT
import { getAddress } from 'viem';
import {
  databaseAddressTransformer,
  databaseNullableAddressTransformer,
} from './database-address.transformer';

const LOWER = '0x52908400098527886e0f7030069857d2e4169ee7';
const CHECKSUMMED = getAddress(LOWER);
const CIPHERTEXT = 'kms:v1:abc123';

describe('databaseAddressTransformer', () => {
  it('checksums plaintext addresses in both directions', () => {
    expect(databaseAddressTransformer.to(LOWER)).toBe(CHECKSUMMED);
    expect(databaseAddressTransformer.from(LOWER)).toBe(CHECKSUMMED);
  });

  it('passes kms: ciphertext through untouched in both directions', () => {
    expect(databaseAddressTransformer.to(CIPHERTEXT)).toBe(CIPHERTEXT);
    expect(databaseAddressTransformer.from(CIPHERTEXT)).toBe(CIPHERTEXT);
  });

  it('still rejects non-address, non-ciphertext values', () => {
    expect(() => databaseAddressTransformer.to('not-an-address')).toThrow();
  });
});

describe('databaseNullableAddressTransformer', () => {
  it('checksums plaintext and preserves null', () => {
    expect(databaseNullableAddressTransformer.to(LOWER)).toBe(CHECKSUMMED);
    expect(databaseNullableAddressTransformer.to(null)).toBeNull();
    expect(databaseNullableAddressTransformer.from(null)).toBeNull();
  });

  it('passes kms: ciphertext through untouched', () => {
    expect(databaseNullableAddressTransformer.from(CIPHERTEXT)).toBe(
      CIPHERTEXT,
    );
  });
});
