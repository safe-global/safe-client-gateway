import { faker } from '@faker-js/faker';
import { type Address, encodeFunctionData, getAddress } from 'viem';
import ProxyFactory130 from '@/abis/safe/v1.3.0/GnosisSafeProxyFactory.abi';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';
import { setupEncoder } from '@/domain/contracts/__tests__/encoders/safe-encoder.builder';

// createProxyWithNonce

type CreateProxyWithNonceArgs = {
  singleton: Address;
  initializer: Address;
  saltNonce: bigint;
};

class SetupEncoder<T extends CreateProxyWithNonceArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
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
