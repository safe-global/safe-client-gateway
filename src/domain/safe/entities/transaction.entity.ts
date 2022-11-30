import { MultisigTransaction } from './multisig-transaction.entity';
import { EthereumTransaction } from './ethereum-transaction.entity';
import { ModuleTransaction } from './module-transaction.entity';

export type Transaction =
  | MultisigTransaction
  | EthereumTransaction
  | ModuleTransaction;
