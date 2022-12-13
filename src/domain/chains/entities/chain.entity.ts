import { NativeCurrency } from './native.currency.entity';
import { RpcUri } from './rpc-uri.entity';
import { BlockExplorerUriTemplate } from './block-explorer-uri-template.entity';
import { Theme } from './theme.entity';
import { GasPriceOracle } from './gas-price-oracle.entity';
import { GasPriceFixed } from './gas-price-fixed.entity';

export interface Chain {
  chainId: string;
  chainName: string;
  description: string;
  l2: boolean;
  shortName: string;
  rpcUri: RpcUri;
  safeAppsRpcUri: RpcUri;
  publicRpcUri: RpcUri;
  blockExplorerUriTemplate: BlockExplorerUriTemplate;
  nativeCurrency: NativeCurrency;
  transactionService: string;
  vpcTransactionService: string;
  theme: Theme;
  gasPrice: Array<GasPriceOracle | GasPriceFixed>;
  ensRegistryAddress: string | null;
  disabledWallets: string[];
  features: string[];
}
