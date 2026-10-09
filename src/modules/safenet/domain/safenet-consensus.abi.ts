// SPDX-License-Identifier: FSL-1.1-MIT
export const safenetConsensusAbi = [
  {
    type: 'function',
    name: 'proposeTransaction',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'oracle', type: 'address' },
      { name: 'extraData', type: 'bytes' },
      {
        name: 'transaction',
        type: 'tuple',
        components: [
          { name: 'chainId', type: 'uint256' },
          { name: 'safe', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'data', type: 'bytes' },
          { name: 'operation', type: 'uint8' },
          { name: 'safeTxGas', type: 'uint256' },
          { name: 'baseGas', type: 'uint256' },
          { name: 'gasPrice', type: 'uint256' },
          { name: 'gasToken', type: 'address' },
          { name: 'refundReceiver', type: 'address' },
          { name: 'nonce', type: 'uint256' },
        ],
      },
    ],
    outputs: [{ name: 'safeTxHash', type: 'bytes32' }],
  },
] as const;
