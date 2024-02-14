import { Builder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import { Hex, parseAbi, encodeFunctionData, getAddress } from 'viem';

// createProxyWithNonce

type CreateProxyWithNonce = {
  singleton: Hex;
  initializer: Hex;
  saltNonce: bigint;
};

class CreateProxyWithNonceEncoder<T extends CreateProxyWithNonce>
  extends Builder<T>
  implements IEncoder
{
  static readonly FUNCTION_SIGNATURE =
    'function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce)';

  encode(): Hex {
    const abi = parseAbi([CreateProxyWithNonceEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'createProxyWithNonce',
      args: [args.singleton, args.initializer, args.saltNonce],
    });
  }
}

export function createProxyWithNonceEncoder(): CreateProxyWithNonceEncoder<CreateProxyWithNonce> {
  return new CreateProxyWithNonceEncoder()
    .with('singleton', getAddress(faker.finance.ethereumAddress()))
    .with('initializer', faker.string.hexadecimal() as Hex)
    .with('saltNonce', faker.number.bigInt());
}
