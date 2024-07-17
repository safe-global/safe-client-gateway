import { IBuilder, Builder } from '@/__tests__/builder';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function createCounterfactualSafeDtoBuilder(): IBuilder<CreateCounterfactualSafeDto> {
  return new Builder<CreateCounterfactualSafeDto>()
    .with('chainId', faker.string.numeric())
    .with('fallbackHandler', getAddress(faker.finance.ethereumAddress()))
    .with('owners', [
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
    ])
    .with('predictedAddress', getAddress(faker.finance.ethereumAddress()))
    .with('saltNonce', faker.string.uuid())
    .with('singletonAddress', getAddress(faker.finance.ethereumAddress()))
    .with('threshold', faker.number.int({ min: 1, max: 10 }));
}
