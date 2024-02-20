import { faker } from '@faker-js/faker';
import { Hex, encodeFunctionData, getAddress, erc20Abi } from 'viem';
import { Builder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';

// transfer

type Erc20TransferArgs = {
  to: Hex;
  value: bigint;
};

class Erc20TransferEncoder<T extends Erc20TransferArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
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
