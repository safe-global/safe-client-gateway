import { EstimationSchema } from '@/modules/estimations/domain/entities/schemas/estimation.schema';
import { faker } from '@faker-js/faker';

describe('EstimationSchema', () => {
  it('should validate a valid estimation', () => {
    const estimation = {
      safeTxGas: faker.string.hexadecimal(),
    };

    const result = EstimationSchema.safeParse(estimation);

    expect(result.success).toBe(true);
  });

  it('should not allow and invalid estimation', () => {
    const estimation = {
      invalid: 'estimation',
    };

    const result = EstimationSchema.safeParse(estimation);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['safeTxGas'],
      },
    ]);
  });

  it('should not validation without safeTxGas', () => {
    const estimation = {};

    const result = EstimationSchema.safeParse(estimation);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received undefined',
        path: ['safeTxGas'],
      },
    ]);
  });
});
