// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { databaseIntegerTransformer } from '@/domain/common/transformers/database-integer.transformer';

describe('databaseIntegerTransformer', () => {
  it('should write numbers through unchanged', () => {
    const value = faker.number.int();

    expect(databaseIntegerTransformer.to(value)).toBe(value);
  });

  it('should read the string node-postgres returns for bigint as a number', () => {
    const value = faker.number.int({ max: Number.MAX_SAFE_INTEGER });

    expect(databaseIntegerTransformer.from(String(value))).toBe(value);
  });

  it('should leave an already numeric value as is', () => {
    expect(databaseIntegerTransformer.from(42)).toBe(42);
  });
});
