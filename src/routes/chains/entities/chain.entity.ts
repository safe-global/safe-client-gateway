import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  NativeCurrency,
  NativeCurrency as ApiNativeCurrency,
} from './native-currency.entity';
import {
  BlockExplorerUriTemplate,
  BlockExplorerUriTemplate as ApiBlockExplorerUriTemplate,
} from './block-explorer-uri-template.entity';
import {
  GasPriceOracle,
  GasPriceOracle as ApiGasPriceOracle,
} from './gas-price-oracle.entity';
import {
  GasPriceFixed,
  GasPriceFixed as ApiGasPriceFixed,
} from './gas-price-fixed.entity';
import { RpcUri, RpcUri as ApiRpcUri } from './rpc-uri.entity';
import { Theme, Theme as ApiTheme } from './theme.entity';

@ApiExtraModels(ApiGasPriceOracle, ApiGasPriceFixed)
export class Chain {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  chainName: string;
  @ApiProperty()
  description: string;
  @ApiProperty()
  l2: boolean;
  @ApiProperty()
  nativeCurrency: ApiNativeCurrency;
  @ApiProperty()
  transactionService: string;
  @ApiProperty()
  blockExplorerUriTemplate: ApiBlockExplorerUriTemplate;
  @ApiProperty()
  disabledWallets: string[];
  @ApiPropertyOptional({ type: String, nullable: true })
  ensRegistryAddress: string | null;
  @ApiProperty()
  features: string[];
  @ApiProperty({
    type: 'array',
    items: {
      oneOf: [
        { $ref: getSchemaPath(ApiGasPriceOracle) },
        { $ref: getSchemaPath(ApiGasPriceFixed) },
      ],
    },
  })
  gasPrice: Array<ApiGasPriceOracle | ApiGasPriceFixed>;
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

  constructor(
    chainId: string,
    chainName: string,
    description: string,
    l2: boolean,
    nativeCurrency: NativeCurrency,
    transactionService: string,
    blockExplorerUriTemplate: BlockExplorerUriTemplate,
    disabledWallets: string[],
    features: string[],
    gasPrice: Array<GasPriceOracle | GasPriceFixed>,
    publicRpcUri: RpcUri,
    rpcUri: RpcUri,
    safeAppsRpcUri: RpcUri,
    shortName: string,
    theme: Theme,
    ensRegistryAddress: string | null,
  ) {
    this.chainId = chainId;
    this.chainName = chainName;
    this.description = description;
    this.l2 = l2;
    this.nativeCurrency = nativeCurrency;
    this.transactionService = transactionService;
    this.blockExplorerUriTemplate = blockExplorerUriTemplate;
    this.disabledWallets = disabledWallets;
    this.ensRegistryAddress = ensRegistryAddress;
    this.features = features;
    this.gasPrice = gasPrice;
    this.publicRpcUri = publicRpcUri;
    this.rpcUri = rpcUri;
    this.safeAppsRpcUri = safeAppsRpcUri;
    this.shortName = shortName;
    this.theme = theme;
  }
}
