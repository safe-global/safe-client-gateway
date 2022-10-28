import { faker } from '@faker-js/faker';
import { Chain } from '../chain.entity';
import { NativeCurrency } from '../native.currency.entity';
import nativeCurrencyFactory from './native.currency.factory';
import { BlockExplorerUriTemplate } from '../block-explorer-uri-template.entity';
import blockExplorerUriTemplateFactory from './block-explorer-uri-template.factory';
import { RpcUri } from '../rpc-uri.entity';
import { Theme } from '../theme.entity';
import { GasPriceOracle } from '../gas-price-oracle.entity';
import themeFactory from './theme.factory';
import { GasPriceFixed } from '../gas-price-fixed.entity';
import gasPriceFixedFactory from './gas-price-fixed.factory';
import gasPriceOracleFactory from './gas-price-oracle.factory';
import rpcUriFactory from './rpc-uri.factory';

export default function (
  chainId?: string,
  chainName?: string,
  description?: string,
  l2?: boolean,
  shortName?: string,
  rpcUri?: RpcUri,
  safeAppsRpcUri?: RpcUri,
  publicRpcUri?: RpcUri,
  blockExplorerUriTemplate?: BlockExplorerUriTemplate,
  nativeCurrency?: NativeCurrency,
  transactionService?: string,
  vpcTransactionService?: string,
  theme?: Theme,
  gasPrice?: Array<GasPriceOracle | GasPriceFixed>,
  ensRegistryAddress?: string,
  disabledWallets?: string[],
  features?: string[],
): Chain {
  return <Chain>{
    chainId: chainId ?? faker.datatype.number().toString(),
    chainName: chainId ?? faker.company.name(),
    description: description ?? faker.random.words(),
    l2: l2 ?? faker.datatype.boolean(),
    shortName: shortName ?? faker.company.companySuffix(),
    rpcUri: rpcUri ?? rpcUriFactory(),
    safeAppsRpcUri: safeAppsRpcUri ?? rpcUriFactory(),
    publicRpcUri: publicRpcUri ?? rpcUriFactory(),
    blockExplorerUriTemplate:
      blockExplorerUriTemplate ?? blockExplorerUriTemplateFactory(),
    nativeCurrency: nativeCurrency ?? nativeCurrencyFactory(),
    transactionService: transactionService ?? faker.internet.url(),
    vpcTransactionService: vpcTransactionService ?? faker.internet.url(),
    theme: theme ?? themeFactory(),
    gasPrice: gasPrice ?? [gasPriceFixedFactory(), gasPriceOracleFactory()],
    ensRegistryAddress: ensRegistryAddress ?? faker.finance.ethereumAddress(),
    disabledWallets: disabledWallets ?? faker.datatype.array(),
    features: features ?? faker.datatype.array(),
  };
}
