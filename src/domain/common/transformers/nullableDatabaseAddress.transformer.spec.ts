import { faker } from '@faker-js/faker/.';
import { nullableDatabaseAddressTransformer } from './nullableDatabaseAddress.transformer';
import { getAddress } from 'viem';

describe('nullableDatabaseAddressTransformer', () => {
  describe('to', () => {
    it('should return null if value is null', () => {
      expect(nullableDatabaseAddressTransformer.to(null)).toBeNull();
    });

    it('should return null if value is undefined', () => {
      expect(nullableDatabaseAddressTransformer.to(undefined)).toBeNull();
    });

    it('should return transformed address if value is a string', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);
      expect(nullableDatabaseAddressTransformer.to(nonChecksummedAddress)).toBe(
        checksummedAddress,
      );
    });
  });

  describe('from', () => {
    it('should return null if value is null', () => {
      expect(nullableDatabaseAddressTransformer.from(null)).toBeNull();
    });

    it('should return transformed address if value is a string', () => {
      const nonChecksummedAddress = faker.finance
        .ethereumAddress()
        .toLowerCase();
      const checksummedAddress = getAddress(nonChecksummedAddress);
      expect(
        nullableDatabaseAddressTransformer.from(nonChecksummedAddress),
      ).toBe(checksummedAddress);
    });
  });
});
