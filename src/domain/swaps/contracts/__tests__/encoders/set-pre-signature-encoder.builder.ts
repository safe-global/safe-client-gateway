import { faker } from '@faker-js/faker';
import { encodeFunctionData, Hex } from 'viem';
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
      faker.string.hexadecimal({ length: 112 }) as `0x${string}`,
    )
    .with('signed', faker.datatype.boolean());
}
