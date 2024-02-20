import { Hex } from 'viem';
import { faker } from '@faker-js/faker';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { erc20TransferEncoder } from '@/domain/relay/contracts/encoders/erc20-encoder.builder';

describe('Erc20Decoder', () => {
  let target: Erc20Decoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new Erc20Decoder();
  });

  it('decodes a transfer function call correctly', () => {
    const transfer = erc20TransferEncoder();
    const args = transfer.build();
    const data = transfer.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'transfer',
      args: [args.to, args.value],
    });
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
