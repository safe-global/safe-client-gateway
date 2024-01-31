import { BlockExplorerUriTemplate } from '@/domain/chains/entities/block-explorer-uri-template.entity';
import { GasPriceFixedEIP1559 } from '@/domain/chains/entities/gas-price-fixed-eip-1559.entity';
import { GasPriceFixed } from '@/domain/chains/entities/gas-price-fixed.entity';
import { GasPriceOracle } from '@/domain/chains/entities/gas-price-oracle.entity';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { RpcUri } from '@/domain/chains/entities/rpc-uri.entity';
import { Theme } from '@/domain/chains/entities/theme.entity';

export interface Chain {
  chainId: string;
  chainName: string;
  description: string;
  l2: boolean;
  // TODO: Make required when deemed stable on config service
  isTestnet?: boolean;
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
