import { faker } from '@faker-js/faker';
import { encodeFunctionData, getAddress } from 'viem';
import ProxyFactory130 from '@/abis/safe/v1.3.0/GnosisSafeProxyFactory.abi';
import { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';
import { setupEncoder } from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';

// createProxyWithNonce

type CreateProxyWithNonceArgs = {
  singleton: `0x${string}`;
  initializer: `0x${string}`;
  saltNonce: bigint;
};

class SetupEncoder<T extends CreateProxyWithNonceArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: ProxyFactory130,
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
