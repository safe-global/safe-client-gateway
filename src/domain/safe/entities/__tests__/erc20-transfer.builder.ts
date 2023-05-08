import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { ERC20Transfer } from '../transfer.entity';

export function erc20TransferBuilder(): IBuilder<ERC20Transfer> {
  return Builder.new<ERC20Transfer>()
    .with('blockNumber', faker.datatype.number())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.datatype.hexadecimal())
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('value', faker.datatype.hexadecimal())
    .with('transferId', faker.datatype.string());
}

export function toJson(erc20Transfer: ERC20Transfer): unknown {
  return {
    ...erc20Transfer,
    type: 'ERC20_TRANSFER',
    executionDate: erc20Transfer.executionDate.toISOString(),
  };
}
