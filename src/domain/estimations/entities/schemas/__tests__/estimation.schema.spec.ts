import { EstimationSchema } from '@/domain/estimations/entities/schemas/estimation.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

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

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['safeTxGas'],
          message: 'Required',
        },
      ]),
    );
  });
});
