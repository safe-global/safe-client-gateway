import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { ERC20Transfer } from '@/domain/safe/entities/transfer.entity';
import { getAddress } from 'viem';

export function erc20TransferBuilder(): IBuilder<ERC20Transfer> {
  return new Builder<ERC20Transfer>()
    .with('type', 'ERC20_TRANSFER')
    .with('blockNumber', faker.number.int())
    .with('executionDate', faker.date.recent())
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`)
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.string.numeric())
    .with('transferId', faker.string.sample());
}

export function toJson(erc20Transfer: ERC20Transfer): unknown {
  return {
    ...erc20Transfer,
    executionDate: erc20Transfer.executionDate.toISOString(),
  };
}
