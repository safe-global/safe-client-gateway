import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { DefiVaultStats } from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import {
  DefiVaultStatsChains,
  DefiVaultStatsProtocols,
} from '@/datasources/staking-api/entities/defi-vault-stats.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function defiVaultStatsBuilder(): IBuilder<DefiVaultStats> {
  return new Builder<DefiVaultStats>()
    .with('asset', getAddress(faker.finance.ethereumAddress()))
    .with('asset_icon', faker.image.url())
    .with('asset_symbol', faker.finance.currencySymbol())
    .with('share_symbol', faker.finance.currencySymbol())
    .with('tvl', faker.string.numeric())
    .with('protocol', faker.helpers.arrayElement(DefiVaultStatsProtocols))
    .with('protocol_icon', faker.image.url())
    .with('protocol_tvl', faker.string.numeric())
    .with('protocol_supply_limit', faker.string.numeric())
    .with('grr', faker.number.float())
    .with('nrr', faker.number.float())
    .with('vault', getAddress(faker.finance.ethereumAddress()))
    .with('chain', faker.helpers.arrayElement(DefiVaultStatsChains))
    .with('chain_id', faker.number.int())
    .with('asset_decimals', faker.number.int())
    .with('updated_at_block', faker.number.int());
}
