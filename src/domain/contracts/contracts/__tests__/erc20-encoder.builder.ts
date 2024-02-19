import { faker } from '@faker-js/faker';
import { Hex, parseAbi, encodeFunctionData, getAddress } from 'viem';
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
  static readonly FUNCTION_SIGNATURE =
    'function transfer(address to, uint256 value)' as const;

  encode(): Hex {
    const abi = parseAbi([Erc20TransferEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
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
