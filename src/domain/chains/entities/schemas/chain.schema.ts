import { JSONSchemaType } from 'ajv';
import { BlockExplorerUriTemplate } from '@/domain/chains/entities/block-explorer-uri-template.entity';
import { Chain } from '@/domain/chains/entities/chain.entity';
import { GasPriceFixedEIP1559 } from '@/domain/chains/entities/gas-price-fixed-eip-1559.entity';
import { GasPriceFixed } from '@/domain/chains/entities/gas-price-fixed.entity';
import { GasPriceOracle } from '@/domain/chains/entities/gas-price-oracle.entity';
import { NativeCurrency } from '@/domain/chains/entities/native.currency.entity';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { RpcUri } from '@/domain/chains/entities/rpc-uri.entity';
import { Theme } from '@/domain/chains/entities/theme.entity';

export const NATIVE_CURRENCY_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/native-currency.json';

export const nativeCurrencySchema: JSONSchemaType<NativeCurrency> = {
  $id: NATIVE_CURRENCY_SCHEMA_ID,
  type: 'object',
  properties: {
    name: { type: 'string' },
    symbol: { type: 'string' },
    decimals: { type: 'number' },
    logoUri: { type: 'string', format: 'uri' },
  },
  required: ['name', 'symbol', 'decimals', 'logoUri'],
};

export const RPC_URI_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/rpc-uri.json';

export const rpcUriSchema: JSONSchemaType<RpcUri> = {
  $id: RPC_URI_SCHEMA_ID,
  type: 'object',
  properties: {
    authentication: {
      type: 'string',
      default: RpcUriAuthentication.Unknown,
      enum: Object.values(RpcUriAuthentication),
    },
    value: { type: 'string' },
  },
  required: ['authentication', 'value'],
};

export const BLOCK_EXPLORER_URI_TEMPLATE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/block-explorer-uri-template.json';

export const blockExplorerUriTemplateSchema: JSONSchemaType<BlockExplorerUriTemplate> =
  {
    $id: BLOCK_EXPLORER_URI_TEMPLATE_SCHEMA_ID,
    type: 'object',
    properties: {
      address: { type: 'string' },
      txHash: { type: 'string' },
      api: { type: 'string' },
    },
    required: ['address', 'txHash', 'api'],
  };

export const THEME_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/theme.json';

export const themeSchema: JSONSchemaType<Theme> = {
  $id: THEME_SCHEMA_ID,
  type: 'object',
  properties: {
    textColor: { type: 'string' },
    backgroundColor: { type: 'string' },
  },
  required: ['textColor', 'backgroundColor'],
};

export const GAS_PRICE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/gas-price.json';

export const gasPriceSchema: JSONSchemaType<
  Array<GasPriceOracle | GasPriceFixed | GasPriceFixedEIP1559>
> = {
  $id: GAS_PRICE_SCHEMA_ID,
  type: 'array',
  items: {
    anyOf: [
      {
        type: 'object',
        properties: {
          type: { const: 'fixed', type: 'string' },
          weiValue: { type: 'string' },
        },
        required: ['type', 'weiValue'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'fixed1559', type: 'string' },
          maxFeePerGas: { type: 'string' },
          maxPriorityFeePerGas: { type: 'string' },
        },
        required: ['type', 'maxFeePerGas', 'maxPriorityFeePerGas'],
      },
      {
        type: 'object',
        properties: {
          type: { const: 'oracle', type: 'string' },
          uri: { type: 'string', format: 'uri' },
          gasParameter: { type: 'string' },
          gweiFactor: { type: 'string' },
        },
        required: ['type', 'uri', 'gasParameter', 'gweiFactor'],
      },
    ],
  },
};

export const CHAIN_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/chain.json';

export const chainSchema: JSONSchemaType<Chain> = {
  type: 'object',
  $id: CHAIN_SCHEMA_ID,
  properties: {
    chainId: { type: 'string' },
    chainName: { type: 'string' },
    description: { type: 'string' },
    // TODO: Make required when deemed stable on config service
    chainLogoUri: { type: 'string', format: 'uri', nullable: true },
    l2: { type: 'boolean' },
    // TODO: Make required when deemed stable on config service
    isTestnet: { type: 'boolean', nullable: true },
    shortName: { type: 'string' },
    rpcUri: { $ref: 'rpc-uri.json' },
    safeAppsRpcUri: { $ref: 'rpc-uri.json' },
    publicRpcUri: { $ref: 'rpc-uri.json' },
    blockExplorerUriTemplate: { $ref: 'block-explorer-uri-template.json' },
    nativeCurrency: { $ref: 'native-currency.json' },
    transactionService: { type: 'string', format: 'uri' },
    vpcTransactionService: { type: 'string', format: 'uri' },
    theme: { $ref: 'theme.json' },
    gasPrice: { $ref: 'gas-price.json' },
    ensRegistryAddress: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    disabledWallets: { type: 'array', items: { type: 'string' } },
    features: { type: 'array', items: { type: 'string' } },
    recommendedMasterCopyVersion: { type: 'string' },
  },
  required: [
    'chainId',
    'chainName',
    'description',
    // 'chainLogoUri',
    'l2',
    // isTestnet,
    'shortName',
    'rpcUri',
    'safeAppsRpcUri',
    'publicRpcUri',
    'blockExplorerUriTemplate',
    'nativeCurrency',
    'transactionService',
    'vpcTransactionService',
    'theme',
    'gasPrice',
    'disabledWallets',
    'features',
    'recommendedMasterCopyVersion',
  ],
};
