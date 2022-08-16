import { NativeCurrency } from './native.currency.entity';

export interface Chain {
  chainId: string;
  chainName: string;
  transactionService: string;
  vpcTransactionService: string;
  nativeCurrency: NativeCurrency;
}
