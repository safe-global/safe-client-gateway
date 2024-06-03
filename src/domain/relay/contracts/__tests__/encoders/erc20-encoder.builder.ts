import { faker } from '@faker-js/faker';
import { encodeFunctionData, getAddress, erc20Abi } from 'viem';
import { Builder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';

// transfer

type Erc20TransferArgs = {
  to: `0x${string}`;
  value: bigint;
};

class Erc20TransferEncoder<T extends Erc20TransferArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [args.to, args.value],
    });
  }
}

export function erc20TransferEncoder(): Erc20TransferEncoder<Erc20TransferArgs> {
  return new Erc20TransferEncoder()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.number.bigInt());
}

// transferFrom

type Erc20TransferFromArgs = {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  amount: bigint;
};

class Erc20TransferFromEncoder<T extends Erc20TransferFromArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transferFrom',
      args: [args.sender, args.recipient, args.amount],
    });
  }
}

export function erc20TransferFromEncoder(): Erc20TransferFromEncoder<Erc20TransferFromArgs> {
  return new Erc20TransferFromEncoder()
    .with('sender', getAddress(faker.finance.ethereumAddress()))
    .with('recipient', getAddress(faker.finance.ethereumAddress()))
    .with('amount', faker.number.bigInt());
}

// transferFrom

type Erc20ApproveArgs = {
  spender: `0x${string}`;
  amount: bigint;
};

class Erc20ApproveEncoder<T extends Erc20ApproveArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [args.spender, args.amount],
    });
  }
}

export function erc20ApproveEncoder(): Erc20ApproveEncoder<Erc20ApproveArgs> {
  return new Erc20ApproveEncoder()
    .with('spender', getAddress(faker.finance.ethereumAddress()))
    .with('amount', faker.number.bigInt());
}
