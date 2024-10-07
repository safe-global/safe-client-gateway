import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { GasPriceOracle } from '@/domain/chains/entities/gas-price-oracle.entity';

export function gasPriceOracleBuilder(): IBuilder<GasPriceOracle> {
  return new Builder<GasPriceOracle>()
    .with('type', 'oracle')
    .with('uri', faker.internet.url({ appendSlash: false }))
    .with('gasParameter', faker.word.sample())
    .with('gweiFactor', faker.string.numeric());
}
