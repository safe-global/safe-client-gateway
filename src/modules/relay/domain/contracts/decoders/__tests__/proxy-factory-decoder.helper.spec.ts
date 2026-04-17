// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { createProxyWithNonceEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';

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
