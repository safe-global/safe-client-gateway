import { faker } from '@faker-js/faker';
import { DateStringSchema } from '@/validation/entities/schemas/date-string.schema';

describe('DateStringSchema', () => {
  it('should validate a valid ISO date string', () => {
    const value = faker.date.recent().toISOString();

    const result = DateStringSchema.safeParse(value);
    expect(result.success && result.data).toBe(value);
  });

  it('should validate valid ISO datetime strings', () => {
    const validDates = [
      '2023-12-25T10:30:00Z',
      '2023-12-25T10:30:00.000Z',
      '2023-12-25T10:30:00.123Z',
    ];

    validDates.forEach((date) => {
      const result = DateStringSchema.safeParse(date);
      expect(result.success).toBe(true);
    });
  });

  it('should not validate an invalid date string', () => {
    const invalidDates = [
      '2023-13-01',
      '2023-12-25', // Date without time
      '2023-12-25T10:30:00+00:00', // Invalid timezone format for Zod
      'December 25, 2023',
      '12/25/2023',
      '25 Dec 2023',
      '2023/12/25',
      '',
      '123abc',
      'Invalid Date',
    ];

    invalidDates.forEach((date) => {
      const result = DateStringSchema.safeParse(date);
      expect(result.success).toBe(false);
    });
  });

  it('should not validate a non-string value', () => {
    const nonStringValues = [
      123,
      null,
      undefined,
      {},
      [],
      new Date(),
      true,
      false,
    ];

    nonStringValues.forEach((value) => {
      const result = DateStringSchema.safeParse(value);
      expect(result.success).toBe(false);
    });
  });

  it('should return correct error message for invalid date string', () => {
    const value = 'invalid-date';

    const result = DateStringSchema.safeParse(value);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Invalid datetime');
  });

  it('should validate edge case datetime strings', () => {
    const edgeCaseDates = [
      '1970-01-01T00:00:00.000Z', // Unix epoch
      '2038-01-19T03:14:07.000Z', // Near 32-bit timestamp limit
      '1900-01-01T00:00:00Z',
      '2100-12-31T23:59:59Z',
    ];

    edgeCaseDates.forEach((date) => {
      const result = DateStringSchema.safeParse(date);
      expect(result.success).toBe(true);
    });
  });
});
