import { GasPriceFixed } from '../gas-price-fixed.entity';
import { faker } from '@faker-js/faker';

export default function (weiValue?: string): GasPriceFixed {
  return <GasPriceFixed>{
    type: 'fixed',
    weiValue: weiValue ?? faker.random.numeric(),
  };
}
