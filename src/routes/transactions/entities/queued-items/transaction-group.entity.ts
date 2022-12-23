import { Transaction } from '../transaction.entity';

export class TransactionGroup {
  nonce: number;
  transactions: Transaction[];
}
