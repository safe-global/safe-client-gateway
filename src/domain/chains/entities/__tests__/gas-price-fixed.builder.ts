import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { GasPriceFixed } from '@/domain/chains/entities/gas-price-fixed.entity';

export function gasPriceFixedBuilder(): IBuilder<GasPriceFixed> {
  return new Builder<GasPriceFixed>()
    .with('type', 'fixed')
    .with('weiValue', faker.string.numeric());
}
