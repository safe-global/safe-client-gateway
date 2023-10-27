import { Hex, encodeFunctionData, getAddress } from 'viem';
import { faker } from '@faker-js/faker';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';

describe('SafeDecoder', () => {
  let target: SafeDecoder;

  beforeEach(() => {
    jest.clearAllMocks();
    target = new SafeDecoder();
  });

  it('decodes an addOwnerWithThreshold function call correctly', () => {
    const owner = faker.finance.ethereumAddress() as Hex;
    const threshold = faker.number.bigInt();

    const data = encodeFunctionData({
      abi: target.abi,
      functionName: 'addOwnerWithThreshold',
      args: [owner, threshold],
    });

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'addOwnerWithThreshold',
      args: [getAddress(owner), threshold],
    });
  });

  it('logs if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
