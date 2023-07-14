import { MultisigTransaction } from './multisig-transaction.entity';
import { EthereumTransaction } from './ethereum-transaction.entity';
import { ModuleTransaction } from './module-transaction.entity';
import { CreationTransaction } from './creation-transaction.entity';

export type Transaction =
  | MultisigTransaction
  | EthereumTransaction
  | ModuleTransaction
  | CreationTransaction;

export function isMultisigTransaction(
  transaction: Transaction,
): transaction is MultisigTransaction {
  return 'safeTxHash' in transaction && transaction.safeTxHash !== undefined;
}

export function isEthereumTransaction(
  transaction: Transaction,
): transaction is EthereumTransaction {
  return 'from' in transaction && transaction.from !== undefined;
}

export function isModuleTransaction(
  transaction: Transaction,
): transaction is ModuleTransaction {
  return 'module' in transaction && transaction.module !== undefined;
}

export function isCreationTransaction(
  transaction: Transaction,
): transaction is CreationTransaction {
  return 'creator' in transaction && transaction.creator !== undefined;
}
