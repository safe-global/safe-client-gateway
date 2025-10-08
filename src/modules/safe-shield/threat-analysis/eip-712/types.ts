export { type Hex } from 'viem';

/** This file is fully copied from @safe-global/types-kit/
 * https://github.com/safe-global/safe-core-sdk/blob/main/packages/types-kit/src/types.ts
 * in order to avoid adding the package as a dependency
 * and reduce the bundle size of the service.
 */

enum OperationType {
  Call, // 0
  DelegateCall, // 1
}

interface MetaTransactionData {
  to: string;
  value: string;
  data: string;
  operation?: OperationType;
}

export interface SafeTransactionData extends MetaTransactionData {
  operation: OperationType;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: number;
}

export interface SafeEIP712Args {
  safeAddress: string;
  safeVersion: string;
  chainId: bigint;
  data: SafeTransactionData | EIP712TypedData | string;
}

export interface EIP712TxTypes {
  EIP712Domain: Array<{
    type: string;
    name: string;
  }>;
  SafeTx: Array<{
    type: string;
    name: string;
  }>;
}

export interface EIP712MessageTypes {
  EIP712Domain: Array<{
    type: string;
    name: string;
  }>;
  SafeMessage: [
    {
      type: 'bytes';
      name: 'message';
    },
  ];
}

export interface EIP712TypedDataTx {
  types: EIP712TxTypes;
  domain: {
    chainId?: string;
    verifyingContract: string;
  };
  primaryType: 'SafeTx';
  message: {
    to: string;
    value: string;
    data: string;
    operation: OperationType;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: string;
    nonce: number;
  };
}

export interface EIP712TypedDataMessage {
  types: EIP712MessageTypes;
  domain: {
    chainId?: number;
    verifyingContract: string;
  };
  primaryType: 'SafeMessage';
  message: {
    message: string;
  };
}

interface TypedDataDomain {
  name?: string;
  version?: string;
  chainId?: number;
  verifyingContract?: string;
  salt?: ArrayLike<number> | string;
}

export interface TypedDataTypes {
  name: string;
  type: string;
}

export type TypedMessageTypes = {
  [key: string]: Array<TypedDataTypes>;
};

export interface EIP712TypedData {
  domain: TypedDataDomain;
  types: TypedMessageTypes;
  message: Record<string, unknown>;
  primaryType?: string;
}
