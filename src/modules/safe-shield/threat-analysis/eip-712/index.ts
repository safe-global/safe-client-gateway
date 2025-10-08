import { hashMessage as performMessageHash } from 'viem';
import type {
  EIP712MessageTypes,
  EIP712TxTypes,
  EIP712TypedData,
  SafeEIP712Args,
  SafeTransactionData,
  EIP712TypedDataMessage,
  EIP712TypedDataTx,
} from './types';
import semverSatisfies from 'semver/functions/satisfies.js';
import { hashTypedData as hashTypedStructuredData } from './encode';

/** This file is fully copied from @safe-global/protocol-kit/
 * https://github.com/safe-global/safe-core-sdk/tree/main/packages/protocol-kit/src/utils/eip-712
 * in order to avoid adding the package as a dependency
 * and reduce the bundle size of the service.
 */

const EQ_OR_GT_1_3_0 = '>=1.3.0';

const EIP712_DOMAIN_BEFORE_V130 = [
  {
    type: 'address',
    name: 'verifyingContract',
  },
];

const EIP712_DOMAIN = [
  {
    type: 'uint256',
    name: 'chainId',
  },
  {
    type: 'address',
    name: 'verifyingContract',
  },
];

// This function returns the types structure for signing off-chain messages according to EIP-712
function getEip712TxTypes(safeVersion: string): EIP712TxTypes {
  const eip712WithChainId = semverSatisfies(safeVersion, EQ_OR_GT_1_3_0);
  return {
    EIP712Domain: eip712WithChainId ? EIP712_DOMAIN : EIP712_DOMAIN_BEFORE_V130,
    SafeTx: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'bytes', name: 'data' },
      { type: 'uint8', name: 'operation' },
      { type: 'uint256', name: 'safeTxGas' },
      { type: 'uint256', name: 'baseGas' },
      { type: 'uint256', name: 'gasPrice' },
      { type: 'address', name: 'gasToken' },
      { type: 'address', name: 'refundReceiver' },
      { type: 'uint256', name: 'nonce' },
    ],
  };
}

function getEip712MessageTypes(safeVersion: string): EIP712MessageTypes {
  const eip712WithChainId = semverSatisfies(safeVersion, EQ_OR_GT_1_3_0);
  return {
    EIP712Domain: eip712WithChainId ? EIP712_DOMAIN : EIP712_DOMAIN_BEFORE_V130,
    SafeMessage: [{ type: 'bytes', name: 'message' }],
  };
}

const hashTypedData = (typedData: EIP712TypedData): string => {
  return hashTypedStructuredData(typedData);
};

const hashMessage = (message: string): string => {
  return performMessageHash(message);
};

const hashSafeMessage = (message: string | EIP712TypedData): string => {
  return typeof message === 'string'
    ? hashMessage(message)
    : hashTypedData(message);
};

export function generateTypedData({
  safeAddress,
  safeVersion,
  chainId,
  data,
}: SafeEIP712Args): EIP712TypedDataTx | EIP712TypedDataMessage {
  // eslint-disable-next-line no-prototype-builtins
  const isSafeTransactionDataType = data.hasOwnProperty('to');

  const eip712WithChainId = semverSatisfies(safeVersion, EQ_OR_GT_1_3_0);

  let typedData: EIP712TypedDataTx | EIP712TypedDataMessage;

  if (isSafeTransactionDataType) {
    const txData = data as SafeTransactionData;

    typedData = {
      types: getEip712TxTypes(safeVersion),
      domain: {
        verifyingContract: safeAddress,
      },
      primaryType: 'SafeTx',
      message: {
        ...txData,
        value: txData.value,
        safeTxGas: txData.safeTxGas,
        baseGas: txData.baseGas,
        gasPrice: txData.gasPrice,
        nonce: txData.nonce,
      },
    };
  } else {
    const message = data as string | EIP712TypedData;

    typedData = {
      types: getEip712MessageTypes(safeVersion),
      domain: {
        verifyingContract: safeAddress,
      },
      primaryType: 'SafeMessage',
      message: { message: hashSafeMessage(message) },
    };
  }

  if (eip712WithChainId) {
    typedData.domain.chainId = Number(chainId);
  }

  return typedData;
}
