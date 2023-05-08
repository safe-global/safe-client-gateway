import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { ERC721Transfer } from '../transfer.entity';

export function erc721TransferBuilder(): IBuilder<ERC721Transfer> {
  return Builder.new<ERC721Transfer>()
    .with('blockNumber', faker.datatype.number())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.datatype.hexadecimal())
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('tokenId', faker.datatype.string())
    .with('transferId', faker.datatype.string());
}

export function toJson(erc721Transfer: ERC721Transfer): unknown {
  return {
    ...erc721Transfer,
    type: 'ERC721_TRANSFER',
    executionDate: erc721Transfer.executionDate.toISOString(),
  };
}
