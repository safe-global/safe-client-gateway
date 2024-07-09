import { faker } from '@faker-js/faker';
import { ProxyFactoryDecoder } from '@/domain/relay/contracts/decoders/proxy-factory-decoder.helper';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('ProxyFactoryDecoder', () => {
  let target: ProxyFactoryDecoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new ProxyFactoryDecoder(mockLoggingService);
  });

  it('decodes a createProxyWithNonce function call correctly', () => {
    const createProxyWithNonce = createProxyWithNonceEncoder();
    const data = createProxyWithNonce.encode();

    const expectedArgs = createProxyWithNonce.build();
    expect(target.decodeFunctionData.createProxyWithNonce(data)).toEqual([
      expectedArgs.singleton,
      expectedArgs.initializer,
      expectedArgs.saltNonce,
    ]);
  });

  it('throws if the incorrect function call was decoded', () => {
    const createProxyWithNonce = createProxyWithNonceEncoder();
    const data = createProxyWithNonce.encode();

    expect(() => target.decodeFunctionData.createProxy(data)).toThrow(
      new Error('Function data matches createProxyWithNonce, not createProxy'),
    );
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as `0x${string}`;

    expect(() =>
      target.decodeFunctionData.createProxyWithNonce(data),
    ).toThrow();
  });
});
