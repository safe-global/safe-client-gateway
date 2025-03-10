import { ZodError } from 'zod';
import { OctavGetPortfolioSchema } from '@/datasources/portfolio-api/entities/octav-get-portfolio.entity';
import type { OctavGetPortfolio } from '@/datasources/portfolio-api/entities/octav-get-portfolio.entity';

describe('OctavGetPortfolioSchema', () => {
  it('should validate a getPortfolio response', () => {
    const portfolio = { example: 'payload' };
    const getPortfolio: OctavGetPortfolio = { getPortfolio: [portfolio] };

    const result = OctavGetPortfolioSchema.safeParse(getPortfolio);

    expect(result.success).toBe(true);
  });

  it('should not validate an invalid getPortfolio response', () => {
    const getPortfolio = { invalid: 'getPortfolio' };

    const result = OctavGetPortfolioSchema.safeParse(getPortfolio);

    expect(result.success).toBe(false);
    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'array',
          received: 'undefined',
          path: ['getPortfolio'],
          message: 'Required',
        },
      ]),
    );
  });
});
