import { faker } from '@faker-js/faker';
import { Hex, encodeFunctionData, erc20Abi, parseAbi } from 'viem';
import {
  _generateEventLogDecoders,
  _generateFunctionDataDecoders,
  _generateHelpers,
} from '@/domain/contracts/decoders/abi-decoder.helper';
import { erc20TransferEncoder } from '@/domain/relay/contracts/__tests__/encoders/erc20-encoder.builder';
import { transactionAddedEventBuilder } from '@/domain/alerts/contracts/__tests__/encoders/delay-modifier-encoder.builder';

describe('AbiDecoder', () => {
  describe('generateHelpers', () => {
    it('should generate helpers', () => {
      const abi = parseAbi(['function example()', 'function example2()']);

      const helpers = _generateHelpers(abi);

      expect(helpers.isExample).toBeDefined();
      expect(helpers.isExample2).toBeDefined();
    });

    it('should not generate helpers for non-function types', () => {
      const abi = parseAbi(['event example()', 'function example2()']);

      const helpers = _generateHelpers(abi);

      // @ts-expect-error - isExample is not defined
      expect(helpers.isExample).not.toBeDefined();
      expect(helpers.isExample2).toBeDefined();
    });

    it('should return true if the data is of the method', () => {
      const abi = parseAbi(['function example()']);
      const data = encodeFunctionData({
        abi,
        functionName: 'example',
      });

      const helpers = _generateHelpers(abi);

      expect(helpers.isExample(data)).toBe(true);
    });

    it('should return false if the data is not of the method', () => {
      const abi = parseAbi(['function example()']);
      const data = faker.string.hexadecimal() as Hex;

      const helpers = _generateHelpers(abi);

      expect(helpers.isExample(data)).toBe(false);
    });
  });

  describe('generateFunctionDataDecoders', () => {
    it('should generate function data decoders', () => {
      const functionDataDecoders = _generateFunctionDataDecoders(erc20Abi);

      expect(functionDataDecoders.transfer).toBeDefined();
      expect(functionDataDecoders.transferFrom).toBeDefined();
    });

    it('should not generate function data decoders for non-function types', () => {
      const functionDataDecoders = _generateFunctionDataDecoders(erc20Abi);

      // @ts-expect-error - Approval is an event
      expect(functionDataDecoders.Approval).not.toBeDefined();
    });

    it('should decode the function data', () => {
      const transfer = erc20TransferEncoder();
      const data = transfer.encode();
      const { to, value } = transfer.build();

      const functionDataDecoders = _generateFunctionDataDecoders(erc20Abi);

      expect(functionDataDecoders.transfer(data)).toEqual([to, value]);
    });

    it('should return null if the function data cannot be decoded', () => {
      const data = faker.string.hexadecimal() as Hex;

      const functionDataDecoders = _generateFunctionDataDecoders(erc20Abi);

      expect(functionDataDecoders.transfer(data)).toEqual(null);
    });
  });

  describe('generateEventDecoders', () => {
    it('should generate function data decoders', () => {
      const eventLogDecoders = _generateEventLogDecoders(erc20Abi);

      expect(eventLogDecoders.Approval).toBeDefined();
      expect(eventLogDecoders.Transfer).toBeDefined();
    });

    it('should not generate function data decoders for non-event types', () => {
      const eventLogDecoders = _generateEventLogDecoders(erc20Abi);

      // @ts-expect-error - transferFrom is a function
      expect(eventLogDecoders.transfer).not.toBeDefined();
    });

    it('should decode the event data', () => {
      const abi = parseAbi([
        'event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)',
      ]);
      const eventLogDecoders = _generateEventLogDecoders(abi);
      const transactionAddedEvent = transactionAddedEventBuilder();
      const event = transactionAddedEvent.encode();

      expect(eventLogDecoders.TransactionAdded(event)).toEqual(
        transactionAddedEvent.build(),
      );
    });

    it('should return null if the event data cannot be decoded', () => {
      const abi = parseAbi([
        'event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, address to, uint256 value, bytes data, uint8 operation)',
      ]);
      const eventLogDecoders = _generateEventLogDecoders(abi);
      const data = faker.string.hexadecimal() as Hex;

      expect(eventLogDecoders.TransactionAdded({ data, topics: [] })).toEqual(
        null,
      );
    });
  });
});
