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

export const BalancesProviderSchema = z.object({
  chainName: z.string().nullish().default(null),
  enabled: z.boolean(),
});

export const ContractAddressesSchema = z
  .object({
    safeSingletonAddress: AddressSchema.nullish().default(null),
    safeProxyFactoryAddress: AddressSchema.nullish().default(null),
    multiSendAddress: AddressSchema.nullish().default(null),
    multiSendCallOnlyAddress: AddressSchema.nullish().default(null),
    fallbackHandlerAddress: AddressSchema.nullish().default(null),
    signMessageLibAddress: AddressSchema.nullish().default(null),
    createCallAddress: AddressSchema.nullish().default(null),
    simulateTxAccessorAddress: AddressSchema.nullish().default(null),
    safeWebAuthnSignerFactoryAddress: AddressSchema.nullish().default(null),
  })
  // TODO: Remove catch after deployed and all chain caches include the `contractAddresses` field
  .catch({
    safeSingletonAddress: null,
    safeProxyFactoryAddress: null,
    multiSendAddress: null,
    multiSendCallOnlyAddress: null,
    fallbackHandlerAddress: null,
    signMessageLibAddress: null,
    createCallAddress: null,
    simulateTxAccessorAddress: null,
    safeWebAuthnSignerFactoryAddress: null,
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
  contractAddresses: ContractAddressesSchema,
  nativeCurrency: NativeCurrencySchema,
  pricesProvider: PricesProviderSchema,
  balancesProvider: BalancesProviderSchema,
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

// TODO: Merge schema definitions with ChainEntity.

export const ChainPageSchema = buildPageSchema(ChainSchema);
