// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { FiatCodeSchema } from '#/modules/balances/routes/v2/entities/fiat-code.schema';

describe('FiatCodeSchema', () => {
  it('accepts a three-letter code in any case', () => {
    const code = faker.finance.currencyCode();

    expect(FiatCodeSchema.safeParse(code).success).toBe(true);
    expect(FiatCodeSchema.safeParse(code.toLowerCase()).success).toBe(true);
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
