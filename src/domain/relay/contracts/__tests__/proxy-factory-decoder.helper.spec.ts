import { Hex } from 'viem';
import { faker } from '@faker-js/faker';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/proxy-factory-decoder.helper';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/proxy-factory-encoder.builder';

describe('ProxyFactoryDecoder', () => {
  let target: ProxyFactoryDecoder;

  beforeEach(() => {
    jest.clearAllMocks();
    target = new ProxyFactoryDecoder();
  });

  it('decodes a createProxyWithNonce function call correctly', () => {
    const createProxyWithNonce = createProxyWithNonceEncoder();
    const args = createProxyWithNonce.build();
    const data = createProxyWithNonce.encode();

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'createProxyWithNonce',
      args: [args.singleton, args.initializer, args.saltNonce],
    });
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(() => target.decodeFunctionData({ data })).toThrow();
  });
});
