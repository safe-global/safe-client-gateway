import semverSatisfies from 'semver/functions/satisfies';
import { hashMessage, hashTypedData, type TypedDataDefinition } from 'viem';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';

const CHAIN_ID_DOMAIN_HASH_VERSION = '>=1.3.0';
const TRANSACTION_PRIMARY_TYPE = 'SafeTx';
const BASE_GAS_SAFETX_HASH_VERSION = '>=1.0.0';
const MESSAGE_PRIMARY_TYPE = 'SafeMessage';

export function getSafeMessageMessageHash(args: {
  chainId: string;
  safe: Safe;
  message: string | TypedDataDefinition;
}): `0x${string}` {
  try {
    return hashTypedData({
      domain: _getSafeMessageDomain({ chainId: args.chainId, safe: args.safe }),
      primaryType: MESSAGE_PRIMARY_TYPE,
      types: {
        [MESSAGE_PRIMARY_TYPE]: [
          {
            name: 'message',
            type: 'bytes',
          },
        ],
      },
      message: {
        message:
          typeof args.message === 'string'
            ? hashMessage(args.message)
            : hashTypedData(args.message),
      },
    });
  } catch {
    throw new Error('Failed to hash message data');
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function _getSafeMessageDomain(args: { chainId: string; safe: Safe }) {
  if (!args.safe.version) {
    throw new Error('Safe version is required');
  }
  const includesChainId = semverSatisfies(
    args.safe.version,
    CHAIN_ID_DOMAIN_HASH_VERSION,
  );
  return {
    ...(includesChainId && { chainId: Number(args.chainId) }),
    verifyingContract: args.safe.address,
  };
}

export type _BaseMultisigTransaction = Pick<
  MultisigTransaction,
  | 'to'
  | 'value'
  | 'data'
  | 'operation'
  | 'safeTxGas'
  | 'baseGas'
  | 'gasPrice'
  | 'gasToken'
  | 'refundReceiver'
  | 'nonce'
>;

export function getSafeTxHash(args: {
  chainId: string;
  transaction: _BaseMultisigTransaction;
  safe: Safe;
}): `0x${string}` {
  if (!args.safe.version) {
    throw new Error('Safe version is required');
  }

  const domain = _getSafeTxDomain({
    address: args.safe.address,
    version: args.safe.version,
    chainId: args.chainId,
  });
  const { types, message } = _getSafeTxTypesAndMessage({
    transaction: args.transaction,
    version: args.safe.version,
  });

  try {
    return hashTypedData({
      domain,
      primaryType: TRANSACTION_PRIMARY_TYPE,
      types,
      message,
    });
  } catch {
    throw new Error('Failed to hash transaction data');
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function _getSafeTxDomain(args: {
  address: Safe['address'];
  version: NonNullable<Safe['version']>;
  chainId: string;
}) {
  const includesChainId = semverSatisfies(
    args.version,
    CHAIN_ID_DOMAIN_HASH_VERSION,
  );
  return {
    ...(includesChainId && { chainId: Number(args.chainId) }),
    verifyingContract: args.address,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function _getSafeTxTypesAndMessage(args: {
  transaction: _BaseMultisigTransaction;
  version: NonNullable<Safe['version']>;
}) {
  const {
    to,
    value,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    nonce,
  } = args.transaction;

  // Transfer of funds has no data
  const data = args.transaction.data || '0x';

  if (
    safeTxGas === null ||
    baseGas === null ||
    gasPrice === null ||
    gasToken === null ||
    refundReceiver === null
  ) {
    throw new Error('Transaction data is incomplete');
  }

  const usesBaseGas = semverSatisfies(
    args.version,
    BASE_GAS_SAFETX_HASH_VERSION,
  );
  const dataGasOrBaseGas = (usesBaseGas ? 'baseGas' : 'dataGas') as 'baseGas';

  return {
    types: {
      [TRANSACTION_PRIMARY_TYPE]: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: dataGasOrBaseGas, type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    message: {
      to,
      value: BigInt(value),
      data,
      operation,
      safeTxGas: BigInt(safeTxGas),
      [dataGasOrBaseGas]: BigInt(baseGas),
      gasPrice: BigInt(gasPrice),
      gasToken,
      refundReceiver,
      nonce: BigInt(nonce),
    },
  };
}
