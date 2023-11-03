import {
  Hex,
  concat,
  encodeFunctionData,
  encodePacked,
  getAddress,
  parseAbi,
  size,
} from 'viem';

export function multiSendEncoder(
  transactions: Array<{
    operation: number;
    to: string;
    value: bigint;
    data: Hex;
  }>,
): Hex {
  const abi = parseAbi(['function multiSend(bytes memory transactions)']);

  const encodedTransactions = transactions.map(
    ({ operation, to, value, data }) =>
      encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [operation, getAddress(to), value, BigInt(size(data)), data],
      ),
  );

  return encodeFunctionData({
    abi,
    functionName: 'multiSend',
    args: [concat(encodedTransactions)],
  });
}
