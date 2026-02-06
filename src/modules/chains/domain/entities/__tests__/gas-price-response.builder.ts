import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { GasPriceResponse } from '@/modules/chains/domain/entities/gas-price-response.entity';

export function gasPriceResponseBuilder(): IBuilder<GasPriceResponse> {
  return new Builder<GasPriceResponse>()
    .with('status', '1')
    .with('message', 'OK')
    .with('result', {
      LastBlock: faker.string.numeric(8),
      SafeGasPrice: faker.number
        .float({ min: 0, max: 2, fractionDigits: 9 })
        .toString(),
      ProposeGasPrice: faker.number
        .float({ min: 0, max: 2, fractionDigits: 9 })
        .toString(),
      FastGasPrice: faker.number
        .float({ min: 0, max: 2, fractionDigits: 9 })
        .toString(),
      suggestBaseFee: faker.number
        .float({ min: 0, max: 2, fractionDigits: 9 })
        .toString(),
      gasUsedRatio: faker.helpers
        .arrayElements(['0.5', '0.6', '0.7', '0.8', '0.9'], 3)
        .join(','),
    });
}
