import { faker } from '@faker-js/faker';
import { TransactionExportDtoSchema } from '@/modules/csv-export/v1/entities/schemas/transaction-export.dto.schema';

describe('TransactionExportDtoSchema', () => {
  it('should validate a valid TransactionExportDto with all fields', () => {
    const validPayload = {
      executionDateGte: faker.date.past().toISOString(),
      executionDateLte: faker.date.recent().toISOString(),
      limit: faker.number.int({ min: 1, max: 1000 }),
      offset: faker.number.int({ min: 0, max: 100 }),
    };

    const result = TransactionExportDtoSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(validPayload);
  });

  it('should validate a valid TransactionExportDto with only optional fields', () => {
    const validPayload = {};

    const result = TransactionExportDtoSchema.safeParse(validPayload);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({});
  });

  it('should not validate invalid executionDateGte and executionDateLte dates', () => {
    const invalidDates = ['invalid-date', '2023-13-01', '', '123abc'];

    invalidDates.forEach((date) => {
      const payload = { executionDateGte: date, executionDateLte: date };
      const result = TransactionExportDtoSchema.safeParse(payload);

      expect(!result.success && result.error.issues).toEqual([
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          path: ['executionDateGte'],
          message: 'Invalid ISO datetime',
        }),
        expect.objectContaining({
          code: 'invalid_format',
          format: 'datetime',
          path: ['executionDateLte'],
          message: 'Invalid ISO datetime',
        }),
      ]);
    });
  });

  it('should not validate zero or negative limit values', () => {
    const invalidLimits = [0, -1, -10];

    invalidLimits.forEach((limit) => {
      const payload = { limit };
      const result = TransactionExportDtoSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].code).toBe('too_small');
      expect(!result.success && result.error.issues[0].path).toEqual(['limit']);
    });
  });

  it('should not validate negative offset values', () => {
    const invalidOffsets = [-1, -10, -100];

    invalidOffsets.forEach((offset) => {
      const payload = { offset };
      const result = TransactionExportDtoSchema.safeParse(payload);

      expect(result.success).toBe(false);
      expect(!result.success && result.error.issues[0].code).toBe('too_small');
      expect(!result.success && result.error.issues[0].path).toEqual([
        'offset',
      ]);
    });
  });

  it('should validate large valid numbers for limit and offset', () => {
    const payload = {
      limit: Number.MAX_SAFE_INTEGER,
      offset: Number.MAX_SAFE_INTEGER,
    };

    const result = TransactionExportDtoSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
