import { Chain } from '../chain.entity';
import { NativeCurrency } from '../native.currency.entity';
import { faker } from '@faker-js/faker';
import nativeCurrencyFactory from './native.currency.factory';

export default function (
  chainId?: string,
  chainName?: string,
  transactionService?: string,
  vpcTransactionService?: string,
  nativeCurrency?: NativeCurrency,
): Chain {
  return <Chain>{
    chainId: chainId || faker.datatype.number(),
    chainName: chainId || faker.company.name(),
    transactionService: transactionService || faker.internet.url(),
    vpcTransactionService: vpcTransactionService || faker.internet.url(),
    nativeCurrency: nativeCurrency || nativeCurrencyFactory(),
  };
}
