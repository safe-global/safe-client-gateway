import { z } from 'zod';
import { RpcUriAuthentication } from '@/modules/chains/domain/entities/rpc-uri-authentication.entity';
import { buildLenientPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { TokenDetailsSchema } from '@/domain/common/schemas/token-metadata.schema';
import {
  NullableAddressSchema,
  NullableStringSchema,
} from '@/validation/entities/schemas/nullable.schema';

export const NativeCurrencySchema = TokenDetailsSchema.extend({
  logoUri: z.url(),
});

export const RpcUriSchema = z.object({
  authentication: z
    .enum(RpcUriAuthentication)
    .catch(() => RpcUriAuthentication.Unknown),
  value: z.string(),
});

export const BlockExplorerUriTemplateSchema = z.object({
  address: z.string(),
  txHash: z.string(),
  api: z.string(),
});

export const BeaconChainExplorerUriTemplateSchema = z.object({
  publicKey: NullableStringSchema,
});

export const ThemeSchema = z.object({
  textColor: z.string(),
  backgroundColor: z.string(),
});

export const GasPriceOracleSchema = z.object({
  type: z.literal('oracle'),
  uri: z.url(),
  gasParameter: z.string(),
  gweiFactor: z.string(),
});

export const GasPriceFixedSchema = z.object({
  type: z.literal('fixed'),
  weiValue: z.string(),
});

export const GasPriceFixedEip1559Schema = z.object({
  type: z.literal('fixed1559'),
  maxFeePerGas: z.string(),
  maxPriorityFeePerGas: z.string(),
});

export const GasPriceSchema = z.array(
  z.discriminatedUnion('type', [
    GasPriceOracleSchema,
    GasPriceFixedSchema,
    GasPriceFixedEip1559Schema,
  ]),
);

export const PricesProviderSchema = z.object({
  chainName: NullableStringSchema,
  nativeCoin: NullableStringSchema,
});

export const BalancesProviderSchema = z.object({
  chainName: NullableStringSchema,
  enabled: z.boolean(),
});

export const ContractAddressesSchema = z.object({
  safeSingletonAddress: NullableAddressSchema,
  safeProxyFactoryAddress: NullableAddressSchema,
  multiSendAddress: NullableAddressSchema,
  multiSendCallOnlyAddress: NullableAddressSchema,
  fallbackHandlerAddress: NullableAddressSchema,
  signMessageLibAddress: NullableAddressSchema,
  createCallAddress: NullableAddressSchema,
  simulateTxAccessorAddress: NullableAddressSchema,
  safeWebAuthnSignerFactoryAddress: NullableAddressSchema,
});

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

export const ChainSchema = z.object({
  chainId: z.string(),
  chainName: z.string(),
  description: z.string(),
  chainLogoUri: z.url().nullish().default(null),
  l2: z.boolean(),
  isTestnet: z.boolean(),
  zk: z
    .boolean()
    // TODO: Remove after Config Service is deployed
    // @see https://github.com/safe-global/safe-config-service/pull/1339
    .catch(false),
  shortName: z.string(),
  rpcUri: RpcUriSchema,
  safeAppsRpcUri: RpcUriSchema,
  publicRpcUri: RpcUriSchema,
  blockExplorerUriTemplate: BlockExplorerUriTemplateSchema,
  beaconChainExplorerUriTemplate: BeaconChainExplorerUriTemplateSchema,
  contractAddresses: ContractAddressesSchema,
  nativeCurrency: NativeCurrencySchema,
  pricesProvider: PricesProviderSchema,
  balancesProvider: BalancesProviderSchema,
  transactionService: z.url().transform(removeTrailingSlash),
  vpcTransactionService: z.url().transform(removeTrailingSlash),
  theme: ThemeSchema,
  gasPrice: GasPriceSchema,
  ensRegistryAddress: NullableAddressSchema,
  disabledWallets: z.array(z.string()),
  features: z.array(z.string()),
  // TODO: Extract and use RelayDtoSchema['version'] when fully migrated to zod
  recommendedMasterCopyVersion: z.string(),
});

// TODO: Merge schema definitions with ChainEntity.

export const ChainLenientPageSchema = buildLenientPageSchema(ChainSchema);
