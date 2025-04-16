import { getAssetPriceSchema } from '@/datasources/balances-api/entities/asset-price.entity';
import { faker } from '@faker-js/faker';

describe('getAssetPriceSchema', () => {
  it('should allow an object with string keys and a mixture of number and null values', () => {
    const currencyCode = faker.finance.currencyCode();
    const assetPrice = {
      [faker.finance.ethereumAddress()]: {
        [currencyCode]: faker.helpers.arrayElement([
          faker.number.float(),
          null,
        ]),
        [`${currencyCode}_24h_change`]: faker.helpers.arrayElement([
          faker.number.float(),
          null,
        ]),
      },
    };

    const result = getAssetPriceSchema(currencyCode).safeParse(assetPrice);

    expect(result.success).toBe(true);
  });

  it('should not validate an object with non-object values', () => {
    const currencyCode = faker.finance.currencyCode();
    const address = faker.finance.ethereumAddress();
    const assetPrice = {
      [address]: faker.number.int(),
    };

    const result = getAssetPriceSchema(currencyCode).safeParse(assetPrice);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'object',
        message: 'Expected object, received number',
        path: [address],
        received: 'number',
      },
    ]);
  });

  it('should not validate an object with non-number or null values in the nested object', () => {
    const address = faker.finance.ethereumAddress();
    const currency = faker.finance.currencyCode();
    const assetPrice = {
      [address]: {
        [currency]: faker.string.alphanumeric(),
        [`${currency}_24h_change`]: faker.string.alphanumeric(),
      },
    };

    const result = getAssetPriceSchema(currency).safeParse(assetPrice);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: [address, currency],
        received: 'string',
      },
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: [address, `${currency}_24h_change`],
        received: 'string',
      },
    ]);
  });
});
