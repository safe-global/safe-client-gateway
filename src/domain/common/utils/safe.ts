import semverSatisfies from 'semver/functions/satisfies';
import { hashTypedData } from 'viem';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { Safe } from '@/domain/safe/entities/safe.entity';

const CHAIN_ID_DOMAIN_HASH_VERSION = '>=1.3.0';
const TRANSACTION_PRIMARY_TYPE = 'SafeTx';
const BASE_GAS_SAFETX_HASH_VERSION = '>=1.0.0';

export type BaseMultisigTransaction = Pick<
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

export function getBaseMultisigTransaction(
  transaction: BaseMultisigTransaction,
): BaseMultisigTransaction {
  return {
    to: transaction.to,
    value: transaction.value,
    data: transaction.data,
    operation: transaction.operation,
    safeTxGas: transaction.safeTxGas,
    baseGas: transaction.baseGas,
    gasPrice: transaction.gasPrice,
    gasToken: transaction.gasToken,
    refundReceiver: transaction.refundReceiver,
    nonce: transaction.nonce,
  };
}

export function getSafeTxHash(args: {
  chainId: string;
  transaction: BaseMultisigTransaction;
  safe: Safe;
}): `0x${string}` {
  if (!args.safe.version) {
    throw new Error('Safe version is required');
  }
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

  const includesChainId = semverSatisfies(
    args.safe.version,
    CHAIN_ID_DOMAIN_HASH_VERSION,
  );
  const domain = {
    ...(includesChainId && { chainId: Number(args.chainId) }),
    verifyingContract: args.safe.address,
  };

  const usesBaseGas = semverSatisfies(
    args.safe.version,
    BASE_GAS_SAFETX_HASH_VERSION,
  );
  const dataGasOrBaseGas = (usesBaseGas ? 'baseGas' : 'dataGas') as 'baseGas';

  try {
    return hashTypedData({
      domain,
      primaryType: TRANSACTION_PRIMARY_TYPE,
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
    });
  } catch {
    throw new Error('Failed to hash transaction data');
  }
}
