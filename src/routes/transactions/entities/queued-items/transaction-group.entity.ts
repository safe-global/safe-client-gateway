import { MultisigTransaction } from '../../../../domain/safe/entities/multisig-transaction.entity';

export class TransactionGroup {
  nonce: number;
  transactions: MultisigTransaction[];
}
