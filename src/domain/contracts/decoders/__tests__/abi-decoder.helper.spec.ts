import { faker } from '@faker-js/faker';
import {
  Abi,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  parseAbi,
  parseAbiParameters,
} from 'viem';

import { erc20TransferEncoder } from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import { transactionAddedEventBuilder } from '@/domain/alerts/contracts/__tests__/encoders/delay-modifier-encoder.builder';
import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

class TestAbiDecoder<TAbi extends Abi> extends AbiDecoder<TAbi> {
  constructor(loggingService: ILoggingService, abi: TAbi) {
    super(loggingService, abi);
  }
}

describe('AbiDecoder', () => {
  describe('helpers', () => {
    it('should generate helpers', () => {
      const abi = parseAbi(['function example()', 'function example2()']);
      const target = new TestAbiDecoder(mockLoggingService, abi);

      expect(target.helpers.isExample).toBeDefined();
      expect(target.helpers.isExample2).toBeDefined();
    });

    it('should not generate helpers for non-function types', () => {
      const abi = parseAbi(['event example()', 'function example2()']);
      const target = new TestAbiDecoder(mockLoggingService, abi);

      // @ts-expect-error - isExample is an event
      expect(target.helpers.isExample).not.toBeDefined();
      expect(target.helpers.isExample2).toBeDefined();
    });

    it('should return true if the data is of the method', () => {
      const abi = parseAbi(['function example()']);
      const data = encodeFunctionData({
        abi,
        functionName: 'example',
      });
      const target = new TestAbiDecoder(mockLoggingService, abi);

      expect(target.helpers.isExample(data)).toBe(true);
    });

    it('should return false if the data is not of the method', () => {
      const abi = parseAbi(['function example()']);
      const data = faker.string.hexadecimal() as `0x${string}`;
      const target = new TestAbiDecoder(mockLoggingService, abi);

      expect(target.helpers.isExample(data)).toBe(false);
    });
  });

  describe('decodeFunctionData', () => {
    it('should generate function data decoders', () => {
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(target.decodeFunctionData.transfer).toBeDefined();
      expect(target.decodeFunctionData.transferFrom).toBeDefined();
    });

    it('should not generate function data decoders for non-function types', () => {
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      // @ts-expect-error - Approval is an event
      expect(target.decodeFunctionData.Approval).not.toBeDefined();
    });

    it('should decode the function data', () => {
      const transfer = erc20TransferEncoder();
      const data = transfer.encode();
      const { to, value } = transfer.build();
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(target.decodeFunctionData.transfer(data)).toEqual([to, value]);
    });

    it('throws if the incorrect function call was decoded', () => {
      const transfer = erc20TransferEncoder();
      const data = transfer.encode();
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(() => target.decodeFunctionData.transferFrom(data)).toThrow(
        new Error('Function data matches transfer, not transferFrom'),
      );
    });

    it('throws if the function data cannot be decoded', () => {
      const data = faker.string.hexadecimal() as `0x${string}`;
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(() => target.decodeFunctionData.transfer(data)).toThrow();
    });
  });

  describe('decodeEventLog', () => {
    it('should generate function data decoders', () => {
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(target.decodeEventLog.Approval).toBeDefined();
      expect(target.decodeEventLog.Transfer).toBeDefined();
    });

    it('should not generate function data decoders for non-event types', () => {
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      // @ts-expect-error - transferFrom is a function
      expect(target.decodeEventLog.transfer).not.toBeDefined();
    });

    it('should decode the event data', () => {
      const abi = parseAbi([
        'event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)',
      ]);
      const transactionAddedEvent = transactionAddedEventBuilder();
      const event = transactionAddedEvent.encode();
      const target = new TestAbiDecoder(mockLoggingService, abi);

      expect(target.decodeEventLog.TransactionAdded(event)).toEqual(
        transactionAddedEvent.build(),
      );
    });

    it('throws if the incorrect event was decoded', () => {
      const to = getAddress(faker.finance.ethereumAddress());
      const from = getAddress(faker.finance.ethereumAddress());
      const data = encodeAbiParameters(
        parseAbiParameters('address to, address from'),
        [to, from],
      );
      const topics = encodeEventTopics({
        abi: erc20Abi,
        eventName: 'Transfer',
        args: {
          from,
          to,
        },
      }) as [signature: `0x${string}`, ...args: Array<`0x${string}`>];
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(() => target.decodeEventLog.Approval({ data, topics })).toThrow(
        new Error('Event matches Transfer, not Approval'),
      );
    });

    it('throws if the event data cannot be decoded', () => {
      const data = faker.string.hexadecimal() as `0x${string}`;
      const target = new TestAbiDecoder(mockLoggingService, erc20Abi);

      expect(() =>
        target.decodeEventLog.Approval({ data, topics: [] }),
      ).toThrow();
    });
  });
});
