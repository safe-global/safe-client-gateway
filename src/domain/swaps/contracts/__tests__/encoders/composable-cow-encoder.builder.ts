import { Builder, IBuilder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';
import { fakeJson } from '@/__tests__/faker';
import { ComposableCowAbi } from '@/domain/swaps/contracts/decoders/composable-cow-decoder.helper';
import { faker } from '@faker-js/faker';
import {
  Hex,
  encodeAbiParameters,
  encodeFunctionData,
  getAddress,
  keccak256,
  parseAbiParameters,
  toHex,
} from 'viem';

type StaticInputArgs = {
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  receiver: `0x${string}`;
  partSellAmount: bigint;
  minPartLimit: bigint;
  t0: bigint;
  n: bigint;
  t: bigint;
  span: bigint;
  appData: `0x${string}`;
};

class StaticInputEncoder<T extends StaticInputArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeAbiParameters(
      parseAbiParameters(
        'address sellToken, address buyToken, address receiver, uint256 partSellAmount, uint256 minPartLimit, uint256 t0, uint256 n, uint256 t, uint256 span, bytes32 appData',
      ),
      [
        args.sellToken,
        args.buyToken,
        args.receiver,
        args.partSellAmount,
        args.minPartLimit,
        args.t0,
        args.n,
        args.t,
        args.span,
        args.appData,
      ],
    );
  }
}

export function staticInputEncoder(): StaticInputEncoder<StaticInputArgs> {
  return new StaticInputEncoder()
    .with('sellToken', getAddress(faker.finance.ethereumAddress()))
    .with('buyToken', getAddress(faker.finance.ethereumAddress()))
    .with('receiver', getAddress(faker.finance.ethereumAddress()))
    .with('partSellAmount', faker.number.bigInt())
    .with('minPartLimit', faker.number.bigInt())
    .with('t0', faker.number.bigInt())
    .with('n', faker.number.bigInt())
    .with('t', faker.number.bigInt())
    .with('span', faker.number.bigInt())
    .with('appData', keccak256(toHex(fakeJson())));
}

type ConditionalOrderParamsArgs = {
  handler: `0x${string}`;
  salt: `0x${string}`;
  staticInput: `0x${string}`;
};

export function conditionalOrderParamsBuilder(): IBuilder<ConditionalOrderParamsArgs> {
  return new Builder<ConditionalOrderParamsArgs>()
    .with('handler', getAddress(faker.finance.ethereumAddress()))
    .with('salt', faker.string.hexadecimal({ length: 64 }) as `0x${string}`)
    .with('staticInput', staticInputEncoder().encode());
}

type CreateWithContextArgs = {
  params: {
    handler: `0x${string}`;
    salt: `0x${string}`;
    staticInput: `0x${string}`;
  };
  factory: `0x${string}`;
  calldata: `0x${string}`;
  dispatch: boolean;
};

class CreateWithContextEncoder<T extends CreateWithContextArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: ComposableCowAbi,
      functionName: 'createWithContext',
      args: [args.params, args.factory, args.calldata, args.dispatch],
    });
  }
}

export function createWithContextEncoder(): CreateWithContextEncoder<CreateWithContextArgs> {
  return new CreateWithContextEncoder()
    .with('params', conditionalOrderParamsBuilder().build())
    .with('factory', getAddress(faker.finance.ethereumAddress()))
    .with('calldata', faker.string.hexadecimal({ length: 64 }) as `0x${string}`)
    .with('dispatch', faker.datatype.boolean());
}
