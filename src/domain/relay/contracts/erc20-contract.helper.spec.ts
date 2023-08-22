import { Erc20ContractHelper } from '@/domain/relay/contracts/erc20-contract.helper';
import { faker } from '@faker-js/faker';
import { concatHex, getAddress, pad, toHex } from 'viem';

describe('ERC20 Contract Helper Tests', () => {
  let target: Erc20ContractHelper;

  beforeEach(() => {
    target = new Erc20ContractHelper();
  });

  it('decodes a transfer correctly', () => {
    const functionSignature = `0xa9059cbb`;
    const to = getAddress(faker.finance.ethereumAddress());
    const value = toHex(faker.number.bigInt());
    const callData = concatHex([functionSignature, pad(to), pad(value)]);

    const actual = target.decode(Erc20ContractHelper.TRANSFER, callData);

    expect(actual).toEqual({ to });
  });

  it('decoding a non transfer call throws', () => {
    const functionSignature = faker.string.hexadecimal({
      length: 8,
    }) as `0x${string}`;
    const arg1 = pad(getAddress(faker.finance.ethereumAddress()));
    const arg2 = pad(getAddress(faker.finance.ethereumAddress()));
    const callData = concatHex([functionSignature, arg1, arg2]);

    expect(() => {
      target.decode(Erc20ContractHelper.TRANSFER, callData);
    }).toThrow();
  });

  it('isCall returns true for a transfer call', () => {
    const functionSignature = `0xa9059cbb`;
    const toAddress = getAddress(faker.finance.ethereumAddress());
    const toArg = pad(toAddress);
    const valueArg = pad(toHex(faker.number.hex()));
    const callData = concatHex([functionSignature, toArg, valueArg]);

    const actual = target.isCall(callData);

    expect(actual).toBe(true);
  });

  it('isCall returns false for a erc contract call', () => {
    const functionSignature = faker.string.hexadecimal({
      length: 8,
    }) as `0x${string}`;
    const arg1 = pad(getAddress(faker.finance.ethereumAddress()));
    const arg2 = pad(getAddress(faker.finance.ethereumAddress()));
    const callData = concatHex([functionSignature, arg1, arg2]);

    const actual = target.isCall(callData);

    expect(actual).toBe(false);
  });
});
