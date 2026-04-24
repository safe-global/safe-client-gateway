// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';
import {
  databaseAddressTransformer,
  databaseNullableAddressTransformer,
} from './databaseAddress.transformer';

describe('databaseAddressTransformer', () => {
  describe('to', () => {
    it('should checksum a valid address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);
      expect(databaseAddressTransformer.to(nonChecksummedAddress)).toBe(
        checksummedAddress,
      );
    });
  });
  describe('from', () => {
    it('should checksum a valid address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);
      expect(databaseAddressTransformer.from(nonChecksummedAddress)).toBe(
        checksummedAddress,
      );
    });
  });
});

describe('databaseNullableAddressTransformer', () => {
  describe('to', () => {
    it('should return null if value is null', () => {
      expect(databaseNullableAddressTransformer.to(null)).toBeNull();
    });
    it('should return null if value is undefined', () => {
      expect(databaseNullableAddressTransformer.to(undefined)).toBeNull();
    });
    it('should checksum a valid address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);
      expect(databaseNullableAddressTransformer.to(nonChecksummedAddress)).toBe(
        checksummedAddress,
      );
    });
  });
  describe('from', () => {
    it('should return null if value is null', () => {
      expect(databaseNullableAddressTransformer.from(null)).toBeNull();
    });
    it('should return null if value is undefined', () => {
      expect(databaseNullableAddressTransformer.from(undefined)).toBeNull();
    });
    it('should checksum a valid address', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);
      expect(
        databaseNullableAddressTransformer.from(nonChecksummedAddress),
      ).toBe(checksummedAddress);
    });
  });
});
