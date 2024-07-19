import { IBuilder, Builder } from '@/__tests__/builder';
import { CreateCounterfactualSafeDto } from '@/domain/accounts/counterfactual-safes/entities/create-counterfactual-safe.dto.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function createCounterfactualSafeDtoBuilder(): IBuilder<CreateCounterfactualSafeDto> {
  return new Builder<CreateCounterfactualSafeDto>()
    .with('chain_id', faker.string.numeric())
    .with('fallback_handler', getAddress(faker.finance.ethereumAddress()))
    .with('owners', [
      getAddress(faker.finance.ethereumAddress()),
      getAddress(faker.finance.ethereumAddress()),
    ])
    .with('predicted_address', getAddress(faker.finance.ethereumAddress()))
    .with('salt_nonce', faker.string.hexadecimal())
    .with('singleton_address', getAddress(faker.finance.ethereumAddress()))
    .with('threshold', faker.number.int({ min: 1, max: 10 }));
}
