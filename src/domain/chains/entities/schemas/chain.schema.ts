import { JSONSchemaType } from 'ajv';
import { Chain } from '../chain.entity';
import { NativeCurrency } from '../native.currency.entity';
import { RpcUriAuthentication } from '../rpc-uri-authentication.entity';
import { RpcUri } from '../rpc-uri.entity';
import { BlockExplorerUriTemplate } from '../block-explorer-uri-template.entity';
import { Theme } from '../theme.entity';
import { GasPriceOracle } from '../gas-price-oracle.entity';
import { GasPriceFixed } from '../gas-price-fixed.entity';

export const nativeCurrencySchema: JSONSchemaType<NativeCurrency> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    symbol: { type: 'string' },
    decimals: { type: 'number' },
    logoUri: { type: 'string', format: 'uri' },
  },
  required: ['name', 'symbol', 'decimals', 'logoUri'],
};

export const rpcUriSchema: JSONSchemaType<RpcUri> = {
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

export const blockExplorerUriTemplateSchema: JSONSchemaType<BlockExplorerUriTemplate> =
  {
    type: 'object',
    properties: {
      address: { type: 'string' },
      txHash: { type: 'string' },
      api: { type: 'string' },
    },
    required: ['address', 'txHash', 'api'],
  };

export const themeSchema: JSONSchemaType<Theme> = {
  type: 'object',
  properties: {
    textColor: { type: 'string' },
    backgroundColor: { type: 'string' },
  },
  required: ['textColor', 'backgroundColor'],
};

export const gasPriceSchema: JSONSchemaType<
  Array<GasPriceOracle | GasPriceFixed>
> = {
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

export const chainSchema: JSONSchemaType<Chain> = {
  type: 'object',
  properties: {
    chainId: { type: 'string' },
    chainName: { type: 'string' },
    shortName: { type: 'string' },
    rpcUri: { $ref: 'rpcUriSchema' },
    safeAppsRpcUri: { $ref: 'rpcUriSchema' },
    publicRpcUri: { $ref: 'rpcUriSchema' },
    blockExplorerUriTemplate: { $ref: 'blockExplorerUriTemplateSchema' },
    nativeCurrency: { $ref: 'nativeCurrencySchema' },
    transactionService: { type: 'string', format: 'uri' },
    vpcTransactionService: { type: 'string', format: 'uri' },
    theme: { $ref: 'themeSchema' },
    gasPrice: { $ref: 'gasPriceSchema' },
    ensRegistryAddress: { type: 'string', nullable: true },
    disabledWallets: { type: 'array', items: { type: 'string' } },
    features: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'chainId',
    'chainName',
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
  ],
};
