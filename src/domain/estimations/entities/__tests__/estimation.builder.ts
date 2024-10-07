import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Estimation } from '@/domain/estimations/entities/estimation.entity';

export function estimationBuilder(): IBuilder<Estimation> {
  return new Builder<Estimation>().with('safeTxGas', faker.string.numeric(5));
}
