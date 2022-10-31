import { MultisigTransactionType } from './multisig-transaction.entity';
import { EthereumTransactionType } from './ethereum-transaction.entity';
import { ModuleTransactionType } from './module-transaction.entity';

export type TransactionType =
  | MultisigTransactionType
  | EthereumTransactionType
  | ModuleTransactionType;
