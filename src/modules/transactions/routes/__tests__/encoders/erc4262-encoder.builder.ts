import { faker } from '@faker-js/faker';
import { type Address, encodeFunctionData, erc4626Abi, getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IEncoder } from '@/__tests__/encoder-builder';

// deposit

type Erc4262DepositArgs = {
  assets: bigint;
  receiver: Address;
};

class Erc4262DepositEncoder<T extends Erc4262DepositArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'deposit',
      args: [args.assets, args.receiver],
    });
  }
}

export function erc4262DepositEncoder(): Erc4262DepositEncoder<Erc4262DepositArgs> {
  return new Erc4262DepositEncoder()
    .with('assets', faker.number.bigInt())
    .with('receiver', getAddress(faker.finance.ethereumAddress()));
}

// withdraw

type Erc4262WithdrawArgs = {
  assets: bigint;
  receiver: Address;
  owner: Address;
};

class Erc4262WithdrawEncoder<T extends Erc4262WithdrawArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: erc4626Abi,
      functionName: 'withdraw',
      args: [args.assets, args.receiver, args.owner],
    });
  }
}

export function erc4262WithdrawEncoder(): Erc4262WithdrawEncoder<Erc4262WithdrawArgs> {
  return new Erc4262WithdrawEncoder()
    .with('assets', faker.number.bigInt())
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('owner', getAddress(faker.finance.ethereumAddress()));
}
