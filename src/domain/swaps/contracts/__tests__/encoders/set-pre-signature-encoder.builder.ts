import { faker } from '@faker-js/faker';
import { encodeFunctionData, Hex, keccak256, toBytes } from 'viem';
import { Builder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';
import { abi } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';

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
      abi,
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
