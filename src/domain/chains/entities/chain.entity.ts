import { NativeCurrency } from './native.currency.entity';
import { RpcUri } from './rpc-uri.entity';
import { BlockExplorerUriTemplate } from './block-explorer-uri-template.entity';
import { Theme } from './theme.entity';
import { GasPriceOracle } from './gas-price-oracle.entity';
import { GasPriceFixed } from './gas-price-fixed.entity';
import { GasPriceFixedEIP1559 } from './gas-price-fixed-eip-1559.entity';

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
  gasPrice: Array<GasPriceOracle | GasPriceFixed | GasPriceFixedEIP1559>;
  ensRegistryAddress: string | null;
  disabledWallets: string[];
  features: string[];
  recommendedMasterCopyVersion: string;
}
