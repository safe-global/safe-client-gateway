import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Estimation } from '@/modules/estimations/domain/entities/estimation.entity';

export function estimationBuilder(): IBuilder<Estimation> {
  return new Builder<Estimation>().with('safeTxGas', faker.string.numeric(5));
}
