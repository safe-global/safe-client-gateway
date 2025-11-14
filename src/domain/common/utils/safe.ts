import semverSatisfies from 'semver/functions/satisfies';
import type { Address } from 'viem';
import { hashMessage, hashTypedData, zeroAddress } from 'viem';
import { MessageSchema } from '@/modules/messages/domain/entities/message.entity';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '@/modules/safe/domain/entities/safe.entity';
import type { TypedData } from '@/modules/messages/domain/entities/typed-data.entity';
import {
  getSafeMigrationDeployments,
  getSafeSingletonDeployments,
  getSafeL2SingletonDeployments,
} from '@/domain/common/utils/deployments';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const CHAIN_ID_DOMAIN_HASH_VERSION = '>=1.3.0';
const TRANSACTION_PRIMARY_TYPE = 'SafeTx';
const BASE_GAS_SAFETX_HASH_VERSION = '>=1.0.0';
const MESSAGE_PRIMARY_TYPE = 'SafeMessage';

export function getSafeMessageMessageHash(args: {
  chainId: string;
  safe: Safe;
  message: string | TypedData;
}): Address {
  if (!args.safe.version) {
    throw new Error('Safe version is required');
  }
  try {
    const message = MessageSchema.shape.message.parse(args.message);

    return hashTypedData({
      domain: _getSafeDomain({
        chainId: args.chainId,
        address: args.safe.address,
        version: args.safe.version,
      }),
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
          typeof message === 'string'
            ? hashMessage(message)
            : hashTypedData(message),
      },
    });
  } catch {
    throw new Error('Failed to hash message data');
  }
}

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
}): Address {
  let version = args.safe.version;

  // If version is null, try to detect it from migration transaction
  if (!version) {
    version = detectVersionFromMigrationTransaction({
      chainId: args.chainId,
      safeAddress: args.safe.address,
      transaction: args.transaction,
    });

    if (!version) {
      throw new Error('Safe version is required');
    }
  }

  const domain = _getSafeDomain({
    address: args.safe.address,
    version,
    chainId: args.chainId,
  });
  const { types, message } = _getSafeTxTypesAndMessage({
    transaction: args.transaction,
    version,
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

/**
 * Attempts to detect the Safe version from a SafeMigration transaction.
 * For Safes with unsupported mastercopies (version = null), if the transaction
 * is a delegate call to an official SafeMigration contract, we can infer the version
 * based on which singletons are deployed on the target chain.
 *
 * @param {string} chainId - Chain ID
 * @param {Address} safeAddress - Safe address
 * @param {BaseMultisigTransaction} transaction - Transaction to analyze
 *
 * @returns {string | null} - Detected version or null if not a valid migration
 */
function detectVersionFromMigrationTransaction(args: {
  chainId: string;
  safeAddress: Address;
  transaction: BaseMultisigTransaction;
}): string | null {
  return detectSafeMigration(args);
}

/**
 * Detects delegate call migrations to SafeMigration contracts (v1.3.0+)
 *
 * SafeMigration contracts use immutable addresses set at deployment and have functions:
 * - migrateL2Singleton()
 * - migrateL2WithFallbackHandler()
 * - migrateSingleton()
 * - migrateWithFallbackHandler()
 *
 * Since these functions have no parameters, we infer the target version by checking
 * which singleton deployments exist on the target chain.
 *
 * @param {string} args.chainId - Chain ID
 * @param {BaseMultisigTransaction} args.transaction - Transaction to analyze
 *
 * @returns {string | null} - Detected version or null if not a valid migration
 */
function detectSafeMigration(args: {
  chainId: string;
  transaction: BaseMultisigTransaction;
}): string | null {
  try {
    // Check if operation is DELEGATECALL
    if (args.transaction.operation !== Operation.DELEGATE) {
      return null;
    }

    // Check if target is an official SafeMigration contract
    const safeMigrationContracts = getSafeMigrationDeployments({
      chainId: args.chainId,
      version: '1.4.1', // SafeMigration was introduced in 1.4.1
    });

    const isSafeMigration = safeMigrationContracts.some(
      (addr) => addr.toLowerCase() === args.transaction.to.toLowerCase(),
    );

    if (!isSafeMigration) {
      return null;
    }

    // Check if transaction has data
    if (!args.transaction.data || args.transaction.data === '0x') {
      return null;
    }

    // Infer version from available singleton deployments on this chain
    const versions = ['1.3.0', '1.4.1'];

    for (const version of versions) {
      const l1Singletons = getSafeSingletonDeployments({
        chainId: args.chainId,
        version,
      });
      const l2Singletons = getSafeL2SingletonDeployments({
        chainId: args.chainId,
        version,
      });

      // If any L1 or L2 singleton exists for this version on this chain, assume that's the target
      if (l1Singletons.length > 0 || l2Singletons.length > 0) {
        return version;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function _getSafeDomain(args: {
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
  transaction: BaseMultisigTransaction;
  version: NonNullable<Safe['version']>;
}) {
  const { to, value, operation, safeTxGas, baseGas, gasPrice, nonce } =
    args.transaction;

  // Transfer of funds has no data
  const data = args.transaction.data || '0x';
  const gasToken = args.transaction.gasToken || zeroAddress;
  const refundReceiver = args.transaction.refundReceiver || zeroAddress;

  if (safeTxGas === null || baseGas === null || gasPrice === null) {
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
