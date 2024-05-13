import { z } from 'zod';
import { RpcUriAuthentication } from '@/domain/chains/entities/rpc-uri-authentication.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';

export const NativeCurrencySchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  logoUri: z.string().url(),
});

export const RpcUriSchema = z.object({
  authentication: z
    .nativeEnum(RpcUriAuthentication)
    .catch(() => RpcUriAuthentication.Unknown),
  value: z.string(),
});

export const BlockExplorerUriTemplateSchema = z.object({
  address: z.string(),
  txHash: z.string(),
  api: z.string(),
});

export const ThemeSchema = z.object({
  textColor: z.string(),
  backgroundColor: z.string(),
});

export const GasPriceOracleSchema = z.object({
  type: z.literal('oracle'),
  uri: z.string().url(),
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
  chainName: z.string().nullish().default(null),
  nativeCoin: z.string().nullish().default(null),
});

export const ChainSchema = z.object({
  chainId: z.string(),
  chainName: z.string(),
  description: z.string(),
  chainLogoUri: z.string().url().nullish().default(null),
  l2: z.boolean(),
  isTestnet: z.boolean(),
  shortName: z.string(),
  rpcUri: RpcUriSchema,
  safeAppsRpcUri: RpcUriSchema,
  publicRpcUri: RpcUriSchema,
  blockExplorerUriTemplate: BlockExplorerUriTemplateSchema,
  nativeCurrency: NativeCurrencySchema,
  pricesProvider: PricesProviderSchema,
  transactionService: z.string().url(),
  vpcTransactionService: z.string().url(),
  theme: ThemeSchema,
  gasPrice: GasPriceSchema,
  ensRegistryAddress: AddressSchema.nullish().default(null),
  disabledWallets: z.array(z.string()),
  features: z.array(z.string()),
  // TODO: Extract and use RelayDtoSchema['version'] when fully migrated to zod
  recommendedMasterCopyVersion: z.string(),
});

export const ChainPageSchema = buildPageSchema(ChainSchema);
