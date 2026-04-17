// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { beaconChainExplorerUriTemplateBuilder } from '@/modules/chains/domain/entities/__tests__/beacon-chain-explorer-uri-template.builder';
import { blockExplorerUriTemplateBuilder } from '@/modules/chains/domain/entities/__tests__/block-explorer-uri-template.builder';
import { contractAddressesBuilder } from '@/modules/chains/domain/entities/__tests__/contract-addresses.builder';
import { gasPriceFixedBuilder } from '@/modules/chains/domain/entities/__tests__/gas-price-fixed.builder';
import { gasPriceFixedEIP1559Builder } from '@/modules/chains/domain/entities/__tests__/gas-price-fixed-eip-1559.builder';
import { gasPriceOracleBuilder } from '@/modules/chains/domain/entities/__tests__/gas-price-oracle.builder';
import { nativeCurrencyBuilder } from '@/modules/chains/domain/entities/__tests__/native.currency.builder';
import { pricesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/prices-provider.builder';
import { rpcUriBuilder } from '@/modules/chains/domain/entities/__tests__/rpc-uri.builder';
import { themeBuilder } from '@/modules/chains/domain/entities/__tests__/theme.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';

export function chainBuilder(): IBuilder<Chain> {
  return new Builder<Chain>()
    .with('chainId', faker.string.numeric())
    .with('chainName', faker.company.name())
    .with('description', faker.word.words())
    .with('chainLogoUri', faker.internet.url({ appendSlash: false }))
    .with('l2', faker.datatype.boolean())
    .with('isTestnet', faker.datatype.boolean())
    .with('zk', faker.datatype.boolean())
    .with('shortName', faker.company.name())
    .with('rpcUri', rpcUriBuilder().build())
    .with('safeAppsRpcUri', rpcUriBuilder().build())
    .with('publicRpcUri', rpcUriBuilder().build())
    .with('blockExplorerUriTemplate', blockExplorerUriTemplateBuilder().build())
    .with(
      'beaconChainExplorerUriTemplate',
      beaconChainExplorerUriTemplateBuilder().build(),
    )
    .with('nativeCurrency', nativeCurrencyBuilder().build())
    .with('pricesProvider', pricesProviderBuilder().build())
    .with('balancesProvider', balancesProviderBuilder().build())
    .with('transactionService', faker.internet.url({ appendSlash: false }))
    .with('vpcTransactionService', faker.internet.url({ appendSlash: false }))
    .with('theme', themeBuilder().build())
    .with('gasPrice', [
      gasPriceFixedBuilder().build(),
      gasPriceFixedEIP1559Builder().build(),
      gasPriceOracleBuilder().build(),
    ])
    .with('ensRegistryAddress', faker.finance.ethereumAddress() as Address)
    .with('disabledWallets', [faker.word.sample(), faker.word.sample()])
    .with('features', [faker.word.sample(), faker.word.sample()])
    .with('recommendedMasterCopyVersion', faker.system.semver());
}
