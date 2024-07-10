import { Builder, IBuilder } from '@/__tests__/builder';
import { ContractAddresses } from '@/domain/chains/entities/contract-addresses.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function contractAddressesBuilder(): IBuilder<ContractAddresses> {
  return new Builder<ContractAddresses>()
    .with('safeSingletonAddress', getAddress(faker.finance.ethereumAddress()))
    .with(
      'safeProxyFactoryAddress',
      getAddress(faker.finance.ethereumAddress()),
    )
    .with('multiSendAddress', getAddress(faker.finance.ethereumAddress()))
    .with(
      'multiSendCallOnlyAddress',
      getAddress(faker.finance.ethereumAddress()),
    )
    .with('fallbackHandlerAddress', getAddress(faker.finance.ethereumAddress()))
    .with('signMessageLibAddress', getAddress(faker.finance.ethereumAddress()))
    .with('createCallAddress', getAddress(faker.finance.ethereumAddress()))
    .with(
      'simulateTxAccessorAddress',
      getAddress(faker.finance.ethereumAddress()),
    );
}
