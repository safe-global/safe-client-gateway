import { GasPriceFixed } from '../gas-price-fixed.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function gasPriceFixedBuilder(): IBuilder<GasPriceFixed> {
  return Builder.new<GasPriceFixed>()
    .with('type', 'fixed')
    .with('weiValue', faker.string.numeric());
}
