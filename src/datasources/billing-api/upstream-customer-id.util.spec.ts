// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  stripDashes,
  withDashes,
} from '@/datasources/billing-api/upstream-customer-id.util';

describe('upstream-customer-id.util', () => {
  describe('stripDashes', () => {
    it('should remove all dashes from a UUID', () => {
      const uuid = faker.string.uuid();

      expect(stripDashes(uuid)).toEqual(uuid.replaceAll('-', ''));
      expect(stripDashes(uuid)).not.toContain('-');
    });
  });

  describe('withDashes', () => {
    it('should restore the standard 8-4-4-4-12 UUID format from a bare hex string', () => {
      const uuid = faker.string.uuid();
      const hex = stripDashes(uuid);

      expect(withDashes(hex)).toEqual(uuid);
    });

    it('should leave a non-hex-32 string unchanged', () => {
      const value = faker.word.noun();

      expect(withDashes(value)).toEqual(value);
    });

    it('should leave an already-dashed UUID unchanged', () => {
      const uuid = faker.string.uuid();

      expect(withDashes(uuid)).toEqual(uuid);
    });
  });
});
