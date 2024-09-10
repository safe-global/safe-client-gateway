import {
  KilnAbi,
  KilnDecoder,
} from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { encodeFunctionData } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('KilnDecoder', () => {
  let kilnDecoder: KilnDecoder;

  beforeEach(() => {
    kilnDecoder = new KilnDecoder(mockLoggingService);
  });

  describe('decodeDeposit', () => {
    it('decodes a deposit function call correctly', () => {
      const data = encodeFunctionData({
        abi: KilnAbi,
        functionName: 'deposit',
        args: [],
      });
      expect(kilnDecoder.decodeDeposit(data)).toEqual({
        parameters: [],
      });
    });

    it('returns null if the data is not a deposit function call', () => {
      const data = faker.string.hexadecimal({ length: 1 }) as `0x${string}`;
      expect(kilnDecoder.decodeDeposit(data)).toBeNull();
    });

    it('returns null if the data is another Kiln function call', () => {
      const data = encodeFunctionData({
        abi: KilnAbi,
        functionName: 'requestValidatorsExit',
        args: [faker.string.hexadecimal({ length: 1 }) as `0x${string}`],
      });
      expect(kilnDecoder.decodeDeposit(data)).toBeNull();
    });
  });

  describe('decodeValidatorsExit', () => {
    it('decodes a requestValidatorsExit function call correctly', () => {
      const validatorsPublicKeys = faker.string.hexadecimal({
        length: 96,
      }) as `0x${string}`;
      const data = encodeFunctionData({
        abi: KilnAbi,
        functionName: 'requestValidatorsExit',
        args: [validatorsPublicKeys],
      });
      expect(kilnDecoder.decodeValidatorsExit(data)).toEqual({
        parameters: [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: validatorsPublicKeys.toLocaleLowerCase(),
            valueDecoded: null,
          },
        ],
      });
    });

    it('returns null if the data is not a requestValidatorsExit function call', () => {
      const data = faker.string.hexadecimal({ length: 1 }) as `0x${string}`;
      expect(kilnDecoder.decodeValidatorsExit(data)).toBeNull();
    });

    it('returns null if the data is another Kiln function call', () => {
      const data = encodeFunctionData({
        abi: KilnAbi,
        functionName: 'batchWithdrawCLFee',
        args: [faker.string.hexadecimal({ length: 1 }) as `0x${string}`],
      });
      expect(kilnDecoder.decodeValidatorsExit(data)).toBeNull();
    });
  });

  describe('decodeBatchWithdrawCLFee', () => {
    it('decodes a batchWithdrawCLFee function call correctly', () => {
      const validatorsPublicKeys = faker.string.hexadecimal({
        length: 96,
      }) as `0x${string}`;
      const data = encodeFunctionData({
        abi: KilnAbi,
        functionName: 'batchWithdrawCLFee',
        args: [validatorsPublicKeys],
      });
      expect(kilnDecoder.decodeBatchWithdrawCLFee(data)).toEqual({
        parameters: [
          {
            name: '_publicKeys',
            type: 'bytes',
            value: validatorsPublicKeys.toLocaleLowerCase(),
            valueDecoded: null,
          },
        ],
      });
    });

    it('returns null if the data is not a batchWithdrawCLFee function call', () => {
      const data = faker.string.hexadecimal({ length: 1 }) as `0x${string}`;
      expect(kilnDecoder.decodeBatchWithdrawCLFee(data)).toBeNull();
    });

    it('returns null if the data is another Kiln function call', () => {
      const data = encodeFunctionData({
        abi: KilnAbi,
        functionName: 'requestValidatorsExit',
        args: [faker.string.hexadecimal({ length: 1 }) as `0x${string}`],
      });
      expect(kilnDecoder.decodeBatchWithdrawCLFee(data)).toBeNull();
    });
  });
});
