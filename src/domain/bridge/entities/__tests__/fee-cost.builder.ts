import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import { tokenBuilder } from '@/domain/bridge/entities/__tests__/token.builder';
import type { IBuilder } from '@/__tests__/builder';
import type { FeeCost } from '@/domain/bridge/entities/fee-cost.entity';

export function feeCostBuilder(): IBuilder<FeeCost> {
  return new Builder<FeeCost>()
    .with('name', faker.word.sample())
    .with('description', faker.lorem.sentence())
    .with('percentage', faker.number.float({ min: 0, max: 1 }).toString())
    .with('token', tokenBuilder().build())
    .with('amount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('amountUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('included', faker.datatype.boolean());
}
