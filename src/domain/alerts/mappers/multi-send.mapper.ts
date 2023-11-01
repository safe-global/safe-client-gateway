import { Injectable } from '@nestjs/common';
import {
  decodeFunctionData,
  getAddress,
  Hex,
  hexToBigInt,
  hexToNumber,
  parseAbi,
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
    const encodedTransactions = multiSend.args[0];

    // Decode after 0x
    let index = 2;

    while (index < encodedTransactions.length) {
      // As we are decoding hex encoded bytes, each byte is represented by 2 chars
      // uint8 operation, address to, value uint256, dataLength uint256, bytes data

      const operation = `0x${encodedTransactions.slice(
        index,
        (index += 2), // 1 byte
      )}` as const;

      const to = `0x${encodedTransactions.slice(
        index,
        (index += 40), // 20 bytes
      )}` as const;

      const value = `0x${encodedTransactions.slice(
        index,
        (index += 64), // 32 bytes
      )}` as const;

      const dataLength = `0x${encodedTransactions.slice(
        index,
        (index += 64), // 32 bytes
      )}` as const;

      const data = `0x${encodedTransactions.slice(
        index,
        (index += hexToNumber(dataLength) * 2), // dataLength bytes
      )}` as const;

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
