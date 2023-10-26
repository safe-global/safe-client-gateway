import { Hex, toHex } from 'viem';
import { faker } from '@faker-js/faker';
import { DelayModifierDecoder } from '@/domain/alerts/contracts/delay-modifier-decoder.helper';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as unknown as ILoggingService;

describe('DelayModifierDecoder', () => {
  let target: DelayModifierDecoder;

  beforeEach(() => {
    jest.clearAllMocks();
    target = new DelayModifierDecoder(mockLoggingService);
  });

  it('decodes a TransactionAdded event correctly', () => {
    const topics = [
      '0x4c8a9c748e976c17c2eb2c2bc50da76eac9cd90ff529f0fe900e0c10a179f031',
      '0x0000000000000000000000000000000000000000000000000000000000000003',
      '0x1aecc7e249b33caa5731f8edd73cf3326920cc5c83c6c43c52ec195c835450f7',
    ] as [Hex, Hex, Hex];
    const data =
      '0x0000000000000000000000008ebf8bbdf773164dac313ea2deb103ff71b04fd500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000440d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000' as const;

    expect(target.decodeEventLog({ data, topics })).toEqual({
      eventName: 'TransactionAdded',
      args: {
        data: '0x0d582f130000000000000000000000003326c5d84bd462ec1cada0b5bba9b2b85059fcba0000000000000000000000000000000000000000000000000000000000000001',
        operation: 0,
        queueNonce: BigInt(3),
        to: '0x8ebF8bbDf773164daC313Ea2DeB103FF71B04Fd5',
        txHash:
          '0x1aecc7e249b33caa5731f8edd73cf3326920cc5c83c6c43c52ec195c835450f7',
        value: BigInt(0),
      },
    });
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('logs if the event cannot be decoded', () => {
    const data = toHex(faker.string.hexadecimal({ length: 514 }));

    expect(target.decodeEventLog({ data, topics: [] })).toBeUndefined();
    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      type: 'invalid_event_log',
      data,
      topics: [],
    });
  });
});
