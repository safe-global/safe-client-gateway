import { faker } from '@faker-js/faker';
import { type Address, encodeFunctionData, parseAbi } from 'viem';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { Builder } from '@/__tests__/builder';

const SignerFactoryAbi = parseAbi([
  'function createSigner(uint256 x, uint256 y, uint176 verifiers) returns (address signer)',
]);

type CreateSignerArgs = {
  x: bigint;
  y: bigint;
  verifiers: bigint;
};

class CreateSignerEncoder<T extends CreateSignerArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Address {
    const args = this.build();

    return encodeFunctionData({
      abi: SignerFactoryAbi,
      functionName: 'createSigner',
      args: [args.x, args.y, args.verifiers],
    });
  }
}

export function createSignerEncoder(): CreateSignerEncoder<CreateSignerArgs> {
  // uint176 max
  const verifiersMax = (1n << 176n) - 1n;
  return new CreateSignerEncoder<CreateSignerArgs>()
    .with('x', faker.number.bigInt())
    .with('y', faker.number.bigInt())
    .with(
      'verifiers',
      faker.number.bigInt({ min: 0n, max: verifiersMax }),
    );
}
