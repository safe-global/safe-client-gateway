// SPDX-License-Identifier: FSL-1.1-MIT
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import type { Address } from 'viem';
import type {
  BeaconChainExplorerUriTemplate as ApiBeaconChainExplorerUriTemplate,
  BeaconChainExplorerUriTemplate,
} from '@/modules/chains/domain/entities/beacon-chain-explorer-uri-template.entity';
import type { BalancesProvider } from '@/modules/chains/routes/entities/balances-provider.entity';
import type {
  BlockExplorerUriTemplate as ApiBlockExplorerUriTemplate,
  BlockExplorerUriTemplate,
} from '@/modules/chains/routes/entities/block-explorer-uri-template.entity';
import type { ContractAddresses } from '@/modules/chains/routes/entities/contract-addresses.entity';
import {
  GasPriceFixed as ApiGasPriceFixed,
  type GasPriceFixed,
} from '@/modules/chains/routes/entities/gas-price-fixed.entity';
import {
  GasPriceFixedEIP1559 as ApiGasPriceFixedEIP1559,
  type GasPriceFixedEIP1559,
} from '@/modules/chains/routes/entities/gas-price-fixed-eip-1559.entity';
import {
  GasPriceOracle as ApiGasPriceOracle,
  type GasPriceOracle,
} from '@/modules/chains/routes/entities/gas-price-oracle.entity';
import type {
  NativeCurrency as ApiNativeCurrency,
  NativeCurrency,
} from '@/modules/chains/routes/entities/native-currency.entity';
import type {
  RpcUri as ApiRpcUri,
  RpcUri,
} from '@/modules/chains/routes/entities/rpc-uri.entity';
import type {
  Theme as ApiTheme,
  Theme,
} from '@/modules/chains/routes/entities/theme.entity';

@ApiExtraModels(ApiGasPriceOracle, ApiGasPriceFixed, ApiGasPriceFixedEIP1559)
export class Chain {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  chainName: string;
  @ApiProperty()
  description: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  chainLogoUri: string | null;
  @ApiProperty()
  l2: boolean;
  @ApiProperty()
  isTestnet: boolean;
  @ApiProperty()
  zk: boolean;
  @ApiProperty()
  nativeCurrency: ApiNativeCurrency;
  @ApiProperty()
  transactionService: string;
  @ApiProperty()
  blockExplorerUriTemplate: ApiBlockExplorerUriTemplate;
  @ApiProperty()
  beaconChainExplorerUriTemplate: ApiBeaconChainExplorerUriTemplate;
  @ApiProperty()
  disabledWallets: Array<string>;
  @ApiPropertyOptional({ type: String, nullable: true })
  ensRegistryAddress: Address | null;
  @ApiProperty()
  balancesProvider: BalancesProvider;
  @ApiProperty()
  contractAddresses: ContractAddresses;
  @ApiProperty()
  features: Array<string>;
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(ApiGasPriceOracle) },
        { $ref: getSchemaPath(ApiGasPriceFixed) },
        { $ref: getSchemaPath(ApiGasPriceFixedEIP1559) },
      ],
    },
  })
  gasPrice: Array<
    ApiGasPriceOracle | ApiGasPriceFixed | ApiGasPriceFixedEIP1559
  >;
  @ApiProperty()
  publicRpcUri: ApiRpcUri;
  @ApiProperty()
  rpcUri: ApiRpcUri;
  @ApiProperty()
  safeAppsRpcUri: ApiRpcUri;
  @ApiProperty()
  shortName: string;
  @ApiProperty()
  theme: ApiTheme;
  @ApiPropertyOptional({ type: String, nullable: true })
  recommendedMasterCopyVersion: string | null;

  constructor(args: {
    chainId: string;
    chainName: string;
    description: string;
    l2: boolean;
    zk: boolean;
    nativeCurrency: NativeCurrency;
    transactionService: string;
    blockExplorerUriTemplate: BlockExplorerUriTemplate;
    beaconChainExplorerUriTemplate: BeaconChainExplorerUriTemplate;
    disabledWallets: Array<string>;
    features: Array<string>;
    gasPrice: Array<GasPriceOracle | GasPriceFixed | GasPriceFixedEIP1559>;
    publicRpcUri: RpcUri;
    rpcUri: RpcUri;
    safeAppsRpcUri: RpcUri;
    shortName: string;
    theme: Theme;
    ensRegistryAddress: Address | null;
    isTestnet: boolean;
    chainLogoUri: string | null;
    balancesProvider: BalancesProvider;
    contractAddresses: ContractAddresses;
    recommendedMasterCopyVersion: string | null;
  }) {
    this.chainId = args.chainId;
    this.chainName = args.chainName;
    this.description = args.description;
    this.chainLogoUri = args.chainLogoUri;
    this.l2 = args.l2;
    this.isTestnet = args.isTestnet;
    this.zk = args.zk;
    this.nativeCurrency = args.nativeCurrency;
    this.transactionService = args.transactionService;
    this.blockExplorerUriTemplate = args.blockExplorerUriTemplate;
    this.beaconChainExplorerUriTemplate = args.beaconChainExplorerUriTemplate;
    this.disabledWallets = args.disabledWallets;
    this.ensRegistryAddress = args.ensRegistryAddress;
    this.features = args.features;
    this.gasPrice = args.gasPrice;
    this.publicRpcUri = args.publicRpcUri;
    this.rpcUri = args.rpcUri;
    this.safeAppsRpcUri = args.safeAppsRpcUri;
    this.shortName = args.shortName;
    this.theme = args.theme;
    this.balancesProvider = args.balancesProvider;
    this.contractAddresses = args.contractAddresses;
    this.recommendedMasterCopyVersion = args.recommendedMasterCopyVersion;
  }
}
