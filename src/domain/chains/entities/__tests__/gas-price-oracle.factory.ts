import { GasPriceOracle } from '../gas-price-oracle.entity';
import { faker } from '@faker-js/faker';

export default function (
  uri?: string,
  gasParameter?: string,
  gweiFactor?: number,
): GasPriceOracle {
  return <GasPriceOracle>{
    type: 'oracle',
    uri: uri ?? faker.internet.url(),
    gasParameter: gasParameter ?? faker.random.word(),
    gweiFactor: gweiFactor ?? faker.random.numeric(),
  };
}
