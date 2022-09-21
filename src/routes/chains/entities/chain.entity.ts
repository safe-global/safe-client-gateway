import { Chain as DomainChain } from '../../../domain/chains/entities/chain.entity';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { NativeCurrency as ApiNativeCurrency } from './native-currency.entity';
import { BlockExplorerUriTemplate as ApiBlockExplorerUriTemplate } from './block-explorer-uri-template.entity';
import { GasPriceOracle as ApiGasPriceOracle } from './gas-price-oracle.entity';
import { GasPriceFixed as ApiGasPriceFixed } from './gas-price-fixed.entity';
import { RpcUri as ApiRpcUri } from './rpc-uri.entity';
import { Theme as ApiTheme } from './theme.entity';

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
