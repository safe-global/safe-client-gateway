import { AbiDecoder } from '@/domain/contracts/decoders/abi-decoder.helper';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress, Hex, hexToBigInt, hexToNumber, size, slice } from 'viem';
import MultiSendCallOnly130 from '@/abis/safe/v1.3.0/MultiSendCallOnly.abi';
import { LoggingService, ILoggingService } from '@/logging/logging.interface';

@Injectable()
export class MultiSendDecoder extends AbiDecoder<typeof MultiSendCallOnly130> {
  // uint8 operation, address to, value uint256, dataLength uint256, bytes data
  private static readonly OPERATION_SIZE = 1;
  private static readonly TO_SIZE = 20;
  private static readonly VALUE_SIZE = 32;
  private static readonly DATA_LENGTH_SIZE = 32;

  constructor(
    @Inject(LoggingService) readonly loggingService: ILoggingService,
  ) {
    super(loggingService, MultiSendCallOnly130);
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

    const multiSend = this.decodeFunctionData.multiSend(multiSendData);

    const transactions = multiSend[0];
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

      const dataLengthNumber = hexToNumber(dataLength);
      const data =
        dataLengthNumber === 0
          ? '0x'
          : slice(transactions, cursor, (cursor += dataLengthNumber));

      mapped.push({
        operation: hexToNumber(operation),
        to: getAddress(to),
        value: hexToBigInt(value),
        data,
      });
    }

    return mapped;
  }
}
