import { Hex, encodeFunctionData, getAddress, parseAbi } from 'viem';
import { faker } from '@faker-js/faker';
import { ILoggingService } from '@/logging/logging.interface';
import { SafeDecoder } from '@/domain/alerts/contracts/safe-decoder.helper';

const mockLoggingService = {
  warn: jest.fn(),
} as unknown as ILoggingService;

const ADD_OWNER_WITH_THRESHOLD_ABI = parseAbi([
  'function addOwnerWithThreshold(address owner, uint256 _threshold)',
]);

describe('SafeDecoder', () => {
  let target: SafeDecoder;

  beforeEach(() => {
    jest.clearAllMocks();
    target = new SafeDecoder(mockLoggingService);
  });

  it('decodes a TransactionAdded event correctly', () => {
    const owner = faker.finance.ethereumAddress() as Hex;
    const threshold = faker.number.bigInt();

    const data = encodeFunctionData({
      abi: ADD_OWNER_WITH_THRESHOLD_ABI,
      functionName: 'addOwnerWithThreshold',
      args: [owner, threshold],
    });

    expect(target.decodeFunctionData({ data })).toEqual({
      functionName: 'addOwnerWithThreshold',
      args: [getAddress(owner), threshold],
    });
    expect(mockLoggingService.warn).not.toHaveBeenCalled();
  });

  it('logs if the event cannot be decoded', () => {
    const data = faker.string.hexadecimal({ length: 138 }) as Hex;

    expect(target.decodeFunctionData({ data })).toBeUndefined();
    expect(mockLoggingService.warn).toHaveBeenCalledWith({
      type: 'invalid_function_data',
      data,
    });
  });
});
