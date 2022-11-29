import { AddressInfo } from '../../common/entities/address-info.entity';
import { TransactionInfo } from './multisig-transaction.entity';

export class CustomTransactionInfo extends TransactionInfo {
  to: AddressInfo | null;
  dataSize: string;
  value: string;
  methodName: string;
  actionCount?: number;
  isCancellation: boolean;
}
