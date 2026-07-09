// SPDX-License-Identifier: FSL-1.1-MIT
import { NonNegativeNumericStringSchema } from '@/validation/entities/schemas/non-negative-numeric-string.schema';

describe('NonNegativeNumericStringSchema', () => {
  it.each([
    '0',
    '1',
    '42',
  ])('should accept a canonical non-negative integer string "%s"', (value) => {
    const result = NonNegativeNumericStringSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it.each([
    ['leading zero', '01'],
    ['leading zeros', '007'],
    ['negative', '-1'],
    ['decimal', '1.5'],
    ['hex', '0x1'],
    ['non-numeric', 'abc'],
    ['empty', ''],
  ])('should reject a %s value', (_label, value) => {
    const result = NonNegativeNumericStringSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
