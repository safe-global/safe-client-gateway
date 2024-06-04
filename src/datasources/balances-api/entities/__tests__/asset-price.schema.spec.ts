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
});
