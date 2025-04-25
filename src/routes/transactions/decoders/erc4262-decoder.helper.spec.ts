import { faker } from '@faker-js/faker';
import { Erc4262Decoder } from '@/routes/transactions/decoders/erc4262-decoder.helper';
import {
  erc4262DepositEncoder,
  erc4262WithdrawEncoder,
} from '@/routes/transactions/__tests__/encoders/erc4262-encoder.builder';

describe('ERC4262Decoder', () => {
  let target: Erc4262Decoder;

  beforeEach(() => {
    target = new Erc4262Decoder();
  });

  it('decodes a deposit function call correctly', () => {
    const deposit = erc4262DepositEncoder();
    const args = deposit.build();
    const data = deposit.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'deposit',
      args: [args.assets, args.receiver],
    });
  });

  it('decodes a withdraw function call correctly', () => {
    const withdraw = erc4262WithdrawEncoder();
    const args = withdraw.build();
    const data = withdraw.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'withdraw',
      args: [args.assets, args.receiver, args.owner],
    });
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as `0x${string}`;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
