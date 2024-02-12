import { AbiDecoder } from '@/domain/alerts/contracts/abi-decoder.helper';
import { Injectable } from '@nestjs/common';
import {
  getAddress,
  Hex,
  hexToBigInt,
  hexToNumber,
  parseAbi,
  size,
  slice,
} from 'viem';

const MULTISEND_ABI = parseAbi([
  'function multiSend(bytes memory transactions)',
]);

@Injectable()
export class MultiSendDecoder extends AbiDecoder<typeof MULTISEND_ABI> {
  // uint8 operation, address to, value uint256, dataLength uint256, bytes data
  private static readonly OPERATION_SIZE = 1;
  private static readonly TO_SIZE = 20;
  private static readonly VALUE_SIZE = 32;
  private static readonly DATA_LENGTH_SIZE = 32;

  constructor() {
    super(MULTISEND_ABI);
  }

  mapMultiSendTransactions(multiSendData: Hex): Array<{
    operation: number;
    to: Hex;
    value: bigint;
    data: Hex;
  }> {
    const mapped: Array<{
      operation: number;
      to: Hex;
      value: bigint;
      data: Hex;
    }> = [];

    const multiSend = this.decodeFunctionData({ data: multiSendData });

    const transactions = multiSend.args[0];
    const transactionsSize = size(transactions);

    let cursor = 0;

    while (cursor < transactionsSize) {
      const operation = slice(
        transactions,
        cursor,
        (cursor += MultiSendDecoder.OPERATION_SIZE),
      );

      const to = slice(
        transactions,
        cursor,
        (cursor += MultiSendDecoder.TO_SIZE),
      );

      const value = slice(
        transactions,
        cursor,
        (cursor += MultiSendDecoder.VALUE_SIZE),
      );

      const dataLength = slice(
        transactions,
        cursor,
        (cursor += MultiSendDecoder.DATA_LENGTH_SIZE),
      );

      const data = slice(
        transactions,
        cursor,
        (cursor += hexToNumber(dataLength)),
      );

      mapped.push({
        operation: hexToNumber(operation),
        to: getAddress(to),
        value: hexToBigInt(value),
        data,
      });
    }

    return mapped;
  }

  isMultiSend(data: `0x${string}`) {
    return this._isFunctionCall({
      functionName: 'multiSend',
      data,
    });
  }
}
