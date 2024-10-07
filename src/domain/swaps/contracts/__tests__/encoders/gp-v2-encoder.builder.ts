import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { encodeFunctionData, keccak256, toBytes } from 'viem';
import { Builder } from '@/__tests__/builder';
import type { IEncoder } from '@/__tests__/encoder-builder';
import { GPv2Abi } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';

type SetPreSignatureArgs = {
  orderUid: `0x${string}`;
  signed: boolean;
};

class SetPreSignatureEncoder<T extends SetPreSignatureArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: GPv2Abi,
      functionName: 'setPreSignature',
      args: [args.orderUid, args.signed],
    });
  }
}

export function setPreSignatureEncoder(): SetPreSignatureEncoder<SetPreSignatureArgs> {
  return new SetPreSignatureEncoder()
    .with(
      'orderUid',
      keccak256(toBytes(faker.string.hexadecimal({ length: 112 }))),
    )
    .with('signed', faker.datatype.boolean());
}
