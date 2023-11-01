import { Injectable } from '@nestjs/common';
import {
  decodeFunctionData,
  getAddress,
  Hex,
  hexToBigInt,
  hexToNumber,
  parseAbi,
  size,
  slice,
} from 'viem';

@Injectable()
export class MultiSendMapper {
  private readonly abi = parseAbi([
    'function multiSend(bytes memory transactions)',
  ]);

  mapMultiSendTransactions(multiSendData: Hex): Array<{
    operation: number;
    to: string;
    value: bigint;
    data: Hex;
  }> {
    const mapped: Array<{
      operation: number;
      to: string;
      value: bigint;
      data: Hex;
    }> = [];

    const multiSend = decodeFunctionData({
      abi: this.abi,
      data: multiSendData,
    });
    const transactions = multiSend.args[0];

    let i = 0;

    while (i < size(transactions)) {
      // uint8 operation, address to, value uint256, dataLength uint256, bytes data
      const operation = slice(transactions, i, (i += 1));
      const to = slice(transactions, i, (i += 20));
      const value = slice(transactions, i, (i += 32));
      const dataLength = slice(transactions, i, (i += 32));
      const data = slice(transactions, i, (i += hexToNumber(dataLength)));

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
