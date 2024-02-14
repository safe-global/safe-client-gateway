import { Hex } from 'viem';
import { faker } from '@faker-js/faker';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/proxy-factory-encoder.builder';

describe('ProxyFactoryDecoder', () => {
  let target: ProxyFactoryDecoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new ProxyFactoryDecoder();
  });

  it('decodes a createProxyWithNonce function call correctly', () => {
    const createProxyWithNonce = createProxyWithNonceEncoder();
    const data = createProxyWithNonce.encode();

    const expectedArgs = createProxyWithNonce.build();
    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'createProxyWithNonce',
      args: [
        expectedArgs.singleton,
        expectedArgs.initializer,
        expectedArgs.saltNonce,
      ],
    });
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
