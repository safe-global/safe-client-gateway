import { Hex } from 'viem';
import { faker } from '@faker-js/faker';
import { SetPreSignatureDecoder } from '@/domain/swaps/contracts/decoders/set-pre-signature-decoder.helper';
import { setPreSignatureEncoder } from '@/domain/swaps/contracts/__tests__/encoders/set-pre-signature-encoder.builder';

describe('SetPreSignatureDecoder', () => {
  let target: SetPreSignatureDecoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new SetPreSignatureDecoder();
  });

  it('decodes a setPreSignature function call correctly', () => {
    const encoder = setPreSignatureEncoder();
    const args = encoder.build();
    const data = encoder.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'setPreSignature',
      args: [args.orderUid, args.signed],
    });
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
