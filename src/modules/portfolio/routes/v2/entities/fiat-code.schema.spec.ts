// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { FiatCodeSchema } from '#/modules/portfolio/routes/v2/entities/fiat-code.schema';

describe('FiatCodeSchema', () => {
  it('accepts a three-letter code in any case and upper-cases it', () => {
    const code = faker.finance.currencyCode();

    expect(FiatCodeSchema.parse(code)).toBe(code);
    expect(FiatCodeSchema.parse(code.toLowerCase())).toBe(code);
  });

  it.each([
    ['symbols', '$$$'],
    ['blanks', '   '],
    ['digits', '123'],
    ['two letters', 'US'],
    ['four letters', 'USDT'],
  ])('rejects %s', (_, code) => {
    expect(FiatCodeSchema.safeParse(code).success).toBe(false);
  });
});
