import { Chain as DomainChain } from '../../../domain/chains/entities/chain.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { NativeCurrency as ApiNativeCurrency } from './api-native-currency';
import { BlockExplorerUriTemplate as ApiBlockExplorerUriTemplate } from './api-block-explorer-uri-template';
import { GasPriceOracle as ApiGasPriceOracle } from './api-gas-price-oracle';
import { GasPriceFixed as ApiGasPriceFixed } from './api-gas-price-fixed';
import { RpcUri as ApiRpcUri } from './api-rpc-uri';
import { Theme as ApiTheme } from './api-theme';

@ApiExtraModels(ApiGasPriceOracle, ApiGasPriceFixed)
export class Chain implements DomainChain {
  @ApiProperty()
  chainId: string;
  @ApiProperty()
  chainName: string;
  @ApiProperty()
  nativeCurrency: ApiNativeCurrency;
  @ApiProperty()
  transactionService: string;
  @ApiProperty()
  vpcTransactionService: string;
  @ApiProperty()
  blockExplorerUriTemplate: ApiBlockExplorerUriTemplate;
  @ApiProperty()
  disabledWallets: string[];
  @ApiPropertyOptional()
  ensRegistryAddress?: string;
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
}
