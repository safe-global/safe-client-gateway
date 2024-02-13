import { faker } from '@faker-js/faker';
import { encodeFunctionData, getAddress, Hex, parseAbi } from 'viem';

import { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';
import { setupEncoder } from '@/domain/contracts/contracts/safe-encoder.builder';

// createProxyWithNonce

type CreateProxyWithNonceArgs = {
  singleton: Hex;
  initializer: Hex;
  saltNonce: bigint;
};

class SetupEncoder<T extends CreateProxyWithNonceArgs>
  extends Builder<T>
  implements IEncoder
{
  static readonly FUNCTION_SIGNATURE =
    'function createProxyWithNonce(address _singleton, bytes memory initializer, uint256 saltNonce)';

  encode(): Hex {
    const abi = parseAbi([SetupEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'createProxyWithNonce',
      args: [args.singleton, args.initializer, args.saltNonce],
    });
  }
}

export function createProxyWithNonceEncoder(): SetupEncoder<CreateProxyWithNonceArgs> {
  const initializer = setupEncoder().encode();
  return new SetupEncoder()
    .with('singleton', getAddress(faker.finance.ethereumAddress()))
    .with('initializer', initializer)
    .with('saltNonce', faker.number.bigInt());
}
