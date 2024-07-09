import { faker } from '@faker-js/faker';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { erc20TransferEncoder } from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('Erc20Decoder', () => {
  let target: Erc20Decoder;

  beforeEach(() => {
    jest.resetAllMocks();
    target = new Erc20Decoder(mockLoggingService);
  });

  it('decodes a transfer function call correctly', () => {
    const transfer = erc20TransferEncoder();
    const args = transfer.build();
    const data = transfer.encode();

    expect(target.decodeFunctionData.transfer(data)).toEqual([
      args.to,
      args.value,
    ]);
  });

  it('throws if the incorrect function call was decoded', () => {
    const transfer = erc20TransferEncoder();
    const data = transfer.encode();

    expect(() => target.decodeFunctionData.transferFrom(data)).toThrow(
      new Error('Function data matches transfer, not transferFrom'),
    );
  });

  it('throws if the function call cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as `0x${string}`;

    expect(() => target.decodeFunctionData.transfer(data)).toThrow();
  });
});
