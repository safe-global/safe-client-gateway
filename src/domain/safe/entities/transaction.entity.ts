import { MultisigTransaction } from './multisig-transaction.entity';
import { EthereumTransaction } from './ethereum-transaction.entity';
import { ModuleTransaction } from './module-transaction.entity';

export type Transaction =
  | MultisigTransaction
  | EthereumTransaction
  | ModuleTransaction;

export function isMultisigTransaction(
  transaction: Transaction,
): transaction is MultisigTransaction {
  return (transaction as MultisigTransaction).safeTxHash !== undefined;
}

export function isEthereumTransaction(
  transaction: Transaction,
): transaction is EthereumTransaction {
  return (transaction as EthereumTransaction).from !== undefined;
}

export function isModuleTransaction(
  transaction: Transaction,
): transaction is ModuleTransaction {
  return (transaction as ModuleTransaction).module !== undefined;
}
