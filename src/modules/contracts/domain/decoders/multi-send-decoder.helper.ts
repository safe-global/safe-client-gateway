// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import {
  getAddress,
  type Hex,
  hexToBigInt,
  hexToNumber,
  size,
  slice,
} from 'viem';
import MultiSendCallOnly130 from '@/abis/safe/v1.3.0/MultiSendCallOnly.abi';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { AbiDecoder } from '@/modules/contracts/domain/decoders/abi-decoder.helper';

@Injectable()
export class MultiSendDecoder extends AbiDecoder<typeof MultiSendCallOnly130> {
  // uint8 operation, address to, value uint256, dataLength uint256, bytes data
  private static readonly OPERATION_SIZE = 1;
  private static readonly TO_SIZE = 20;
  private static readonly VALUE_SIZE = 32;
  private static readonly DATA_LENGTH_SIZE = 32;

  constructor(
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    super(MultiSendCallOnly130);
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

    try {
      const multiSend = this.decodeFunctionData({ data: multiSendData });

      const transactions = multiSend.args[0];
      const transactionsSize = size(transactions);

      let cursor = 0;

      while (cursor < transactionsSize) {
        const operationEnd = cursor + MultiSendDecoder.OPERATION_SIZE;
        const operation = slice(transactions, cursor, operationEnd);
        cursor = operationEnd;

        const toEnd = cursor + MultiSendDecoder.TO_SIZE;
        const to = slice(transactions, cursor, toEnd);
        cursor = toEnd;

        const valueEnd = cursor + MultiSendDecoder.VALUE_SIZE;
        const value = slice(transactions, cursor, valueEnd);
        cursor = valueEnd;

        const dataLengthEnd = cursor + MultiSendDecoder.DATA_LENGTH_SIZE;
        const dataLength = slice(transactions, cursor, dataLengthEnd);
        cursor = dataLengthEnd;

        const dataLengthNumber = hexToNumber(dataLength);
        let data: Hex = '0x';
        if (dataLengthNumber !== 0) {
          const dataEnd = cursor + dataLengthNumber;
          data = slice(transactions, cursor, dataEnd);
          cursor = dataEnd;
        }

        mapped.push({
          operation: hexToNumber(operation),
          to: getAddress(to),
          value: hexToBigInt(value),
          data,
        });
      }
    } catch (e) {
      this.loggingService.warn(`Error decoding MultiSend transaction: ${e}`);
    }

    return mapped;
  }
}
