import { faker } from '@faker-js/faker';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/decoders/proxy-factory-decoder.helper';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/encoders/proxy-factory-encoder.builder';

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
    expect(
      target.decodeFunctionData({ data, functionName: 'createProxyWithNonce' }),
    ).toEqual([
      expectedArgs.singleton,
      expectedArgs.initializer,
      expectedArgs.saltNonce,
    ]);
  });

  it('should return null if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as `0x${string}`;

    expect(
      target.decodeFunctionData({ data, functionName: 'createProxyWithNonce' }),
    ).toBe(null);
  });
});
