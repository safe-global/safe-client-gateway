import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ERC721Transfer } from '@/modules/safe/domain/entities/transfer.entity';
import { type Address, getAddress } from 'viem';

export function erc721TransferBuilder(): IBuilder<ERC721Transfer> {
  return new Builder<ERC721Transfer>()
    .with('type', 'ERC721_TRANSFER')
    .with('blockNumber', faker.number.int())
    .with('executionDate', faker.date.recent())
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as Address)
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('tokenId', faker.string.sample())
    .with('transferId', faker.string.sample());
}

export function toJson(erc721Transfer: ERC721Transfer): unknown {
  return {
    ...erc721Transfer,
    executionDate: erc721Transfer.executionDate.toISOString(),
  };
}
