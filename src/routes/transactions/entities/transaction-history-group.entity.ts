import { MultisigTransaction } from './multisig-transaction.entity';
import { ModuleTransaction } from './module-transaction.entity';

export class TransactionItemGroup {
  timestamp: number;
  transactions: MultisigTransaction[] | ModuleTransaction[];
}
