import { MultisigTransaction } from '../../../domain/safe/entities/multisig-transaction.entity';
import { ModuleTransaction } from '../../../domain/safe/entities/module-transaction.entity';
import { EthereumTransaction } from '../../../domain/safe/entities/ethereum-transaction.entity';

export class TransactionDomainGroup {
  timestamp: number;
  transactions:
    | MultisigTransaction[]
    | ModuleTransaction[]
    | EthereumTransaction[];
}
