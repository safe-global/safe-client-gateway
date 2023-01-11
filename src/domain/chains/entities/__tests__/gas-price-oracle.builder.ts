import { GasPriceOracle } from '../gas-price-oracle.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function gasPriceOracleBuilder(): IBuilder<GasPriceOracle> {
  return Builder.new<GasPriceOracle>()
    .with('type', 'oracle')
    .with('uri', faker.internet.url())
    .with('gasParameter', faker.random.word())
    .with('gweiFactor', faker.random.numeric());
}
