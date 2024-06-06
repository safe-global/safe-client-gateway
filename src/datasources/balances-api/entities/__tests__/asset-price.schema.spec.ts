import { AssetPriceSchema } from '@/datasources/balances-api/entities/asset-price.entity';
import { faker } from '@faker-js/faker';

describe('AssetPriceSchema', () => {
  it('should allow an object with string keys and a mixture of number and null values', () => {
    const assetPrice = {
      [faker.finance.ethereumAddress()]: {
        [faker.finance.currencyCode()]: faker.helpers.arrayElement([
          faker.number.float(),
          null,
        ]),
      },
    };

    const result = AssetPriceSchema.safeParse(assetPrice);

    expect(result.success).toBe(true);
  });

  it('should not validate an object with non-object values', () => {
    const address = faker.finance.ethereumAddress();
    const assetPrice = {
      [address]: faker.number.int(),
    };

    const result = AssetPriceSchema.safeParse(assetPrice);

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
      },
    };

    const result = AssetPriceSchema.safeParse(assetPrice);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'number',
        message: 'Expected number, received string',
        path: [address, currency],
        received: 'string',
      },
    ]);
  });
});
